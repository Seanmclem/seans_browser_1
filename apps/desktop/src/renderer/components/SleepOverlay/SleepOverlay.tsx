import styles from "./SleepOverlay.module.css";

interface SleepOverlayProps {
  snapshot: string;
  state: string;
}

export function SleepOverlay({ snapshot, state }: SleepOverlayProps) {
  return (
    <div className={styles.overlay}>
      <img className={styles.snapshot} src={snapshot} alt="Sleeping tab preview" />
      <div className={styles.badge}>{state === "hard-sleeping" ? "Hard Sleep" : "Soft Sleep"}</div>
    </div>
  );
}

