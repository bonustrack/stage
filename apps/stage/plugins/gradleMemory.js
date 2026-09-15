const GRADLE_JVMARGS =
  '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

function setGradleMemory(props) {
  const existing = props.find((p) => p.type === 'property' && p.key === 'org.gradle.jvmargs');
  if (existing) existing.value = GRADLE_JVMARGS;
  else props.push({ type: 'property', key: 'org.gradle.jvmargs', value: GRADLE_JVMARGS });
  return props;
}

module.exports = { GRADLE_JVMARGS, setGradleMemory };
