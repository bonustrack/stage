export interface FooterPinProps {
  children: React.ReactNode;
  onHeight: (h: number) => void;
  memberList: boolean;
}

export function FooterPin({ children }: FooterPinProps): React.ReactElement {
  return <>{children}</>;
}
