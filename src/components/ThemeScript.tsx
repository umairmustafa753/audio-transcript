/**
 * Applies the saved theme before first paint so a dark-mode user never sees a
 * white flash. Kept deliberately tiny and dependency-free.
 */
const SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("audio-transcription:settings:v1");
    var theme = raw ? (JSON.parse(raw) || {}).theme : null;
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
