import { font } from "../fonts";
import { OVERLAY_THEME } from "../theme";
import type { ProjectLabelElement } from "../model";
import type { RenderContext } from "./types";
import { fillTextSpaced, fitFontPx, withHalo } from "./text";

export function drawProjectLabel(ctx: CanvasRenderingContext2D, el: ProjectLabelElement, w: number, h: number, rc: RenderContext): void {
  const u = rc.unit;
  const pad = 0.12 * h;
  const companyName = el.showCompany ? rc.branding.companyName : null;
  const hasCompany = companyName !== null && companyName !== "";

  const draw = () => {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = pad;

    const captionPx = h * (hasCompany ? 0.18 : 0.24);
    ctx.font = font("DTS Sans SemiBold", captionPx);
    ctx.fillStyle = OVERLAY_THEME.label;
    fillTextSpaced(ctx, el.caption.toUpperCase(), pad, y, 0.14 * captionPx, "left");
    y += captionPx + 0.06 * h;

    const namePx = h * (hasCompany ? 0.36 : 0.46);
    const name = rc.branding.projectName.toUpperCase();
    const fittedNamePx = fitFontPx(ctx, "DTS Sans SemiBold", namePx, name, w - 2 * pad);
    ctx.font = font("DTS Sans SemiBold", fittedNamePx);
    ctx.fillStyle = OVERLAY_THEME.value;
    ctx.fillText(name, pad, y);
    y += fittedNamePx + 0.06 * h;

    if (hasCompany) {
      const companyPx = h * 0.18;
      const fittedCompanyPx = fitFontPx(ctx, "DTS Sans Medium", companyPx, companyName, w - 2 * pad);
      ctx.font = font("DTS Sans Medium", fittedCompanyPx);
      ctx.fillStyle = OVERLAY_THEME.muted;
      ctx.fillText(companyName, pad, y);
    }
  };

  if (el.background === "panel") {
    const r = Math.min(0.06 * Math.min(w, h), 12 * u);
    ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, 0.62)`;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
    draw();
  } else {
    withHalo(ctx, u, draw);
  }
}
