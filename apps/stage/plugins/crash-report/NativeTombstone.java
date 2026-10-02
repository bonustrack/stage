package box.stage.diagnostics;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

final class NativeTombstone {
  private static final int MAX_BYTES = 4 * 1024 * 1024;

  static String read(InputStream input) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    for (int size; (size = input.read(buffer)) != -1;) {
      if (bytes.size() + size > MAX_BYTES) throw new IOException("Trace exceeds size limit");
      bytes.write(buffer, 0, size);
    }
    byte[] data = bytes.toByteArray();
    Proto root = new Proto(data, 0, data.length);
    long tid = 0;
    StringBuilder report = new StringBuilder();
    while (root.next()) {
      if (root.field == 6) tid = root.number();
      if (root.field == 10) appendSignal(report, root.message());
    }
    root = new Proto(data, 0, data.length);
    boolean found = false;
    while (root.next()) {
      if (root.field != 16) continue;
      Proto entry = root.message();
      long key = 0;
      Proto thread = null;
      while (entry.next()) {
        if (entry.field == 1) key = entry.number();
        if (entry.field == 2) thread = entry.message();
      }
      if (key == tid && thread != null) {
        appendFrames(report, thread);
        found = true;
        break;
      }
    }
    if (!found) report.append("No crashing-thread frames in retained trace.\n");
    return report.toString();
  }

  private static void appendSignal(StringBuilder report, Proto signal) throws IOException {
    long number = 0;
    long code = 0;
    while (signal.next()) {
      if (signal.field == 1) number = signal.number();
      if (signal.field == 3) code = signal.number();
    }
    report.append("Signal: ").append(number).append("; code: ").append((int) code).append('\n');
  }

  private static void appendFrames(StringBuilder report, Proto thread) throws IOException {
    int count = 0;
    while (thread.next()) {
      if (thread.field != 4) continue;
      if (count == 40) {
        report.append("Remaining frames omitted.\n");
        break;
      }
      appendFrame(report, thread.message(), count++);
    }
    if (count == 0) report.append("Crashing-thread backtrace is empty.\n");
  }

  private static void appendFrame(StringBuilder report, Proto frame, int index) throws IOException {
    long pc = 0;
    long offset = 0;
    String name = "";
    String file = "[code]";
    String build = "";
    while (frame.next()) {
      switch (frame.field) {
        case 1: pc = frame.number(); break;
        case 4: name = symbol(frame.text()); break;
        case 5: offset = frame.number(); break;
        case 6: file = module(frame.text()); break;
        case 8:
          String id = frame.text();
          if (id.matches("[a-fA-F0-9]{1,128}")) build = id;
          break;
        default: break;
      }
    }
    report.append('#').append(index).append(" pc ").append(Long.toHexString(pc))
        .append(' ').append(file);
    if (!name.isEmpty()) report.append(' ').append(name).append('+').append(offset);
    if (!build.isEmpty()) report.append(" (BuildId: ").append(build).append(')');
    report.append('\n');
  }

  private static String symbol(String value) {
    if (value.length() > 240) return "[long symbol]";
    return value.matches("[A-Za-z0-9_.$<>:(), *&~+\\[\\]{}=-]*") ? value : "[symbol omitted]";
  }

  private static String module(String path) {
    String name = path.substring(path.lastIndexOf('/') + 1);
    return name.matches("[A-Za-z0-9_.+-]{1,120}\\.(so|apk|oat|odex|dex)") ? name : "[code]";
  }

  private static final class Proto {
    private final byte[] bytes;
    private final int end;
    private int position;
    private int valueStart;
    private int valueEnd;
    private long value;
    private int wire;
    int field;

    Proto(byte[] bytes, int start, int end) {
      this.bytes = bytes;
      this.position = start;
      this.end = end;
    }

    boolean next() throws IOException {
      if (position == end) return false;
      long tag = varint();
      if (tag == 0 || tag > 0xffffffffL) throw new IOException("Invalid protobuf tag");
      field = (int) (tag >>> 3);
      wire = (int) (tag & 7);
      if (field == 0) throw new IOException("Invalid protobuf field");
      if (wire == 0) {
        value = varint();
      } else if (wire == 1 || wire == 2 || wire == 5) {
        long length = wire == 2 ? varint() : (wire == 1 ? 8 : 4);
        if (length < 0 || length > end - position) throw new IOException("Truncated protobuf");
        valueStart = position;
        position += (int) length;
        valueEnd = position;
      } else {
        throw new IOException("Unsupported protobuf wire type");
      }
      return true;
    }

    private long varint() throws IOException {
      long result = 0;
      for (int shift = 0; shift < 64; shift += 7) {
        if (position == end) throw new IOException("Truncated protobuf varint");
        int b = bytes[position++] & 255;
        if (shift == 63 && (b & 254) != 0) throw new IOException("Invalid protobuf varint");
        result |= (long) (b & 127) << shift;
        if ((b & 128) == 0) return result;
      }
      throw new IOException("Invalid protobuf varint");
    }

    long number() throws IOException {
      if (wire != 0) throw new IOException("Expected protobuf number");
      return value;
    }

    Proto message() throws IOException {
      if (wire != 2) throw new IOException("Expected protobuf message");
      return new Proto(bytes, valueStart, valueEnd);
    }

    String text() throws IOException {
      if (wire != 2) throw new IOException("Expected protobuf text");
      if (valueEnd - valueStart > 4096) return "";
      return new String(bytes, valueStart, valueEnd - valueStart, StandardCharsets.UTF_8);
    }
  }
}
