import React from 'react';

interface LabelData {
  displayName: string;
  jobFunctionName: string;
  companyName: string;
  projectName: string;
  projectType: string;
  code: string;
  bloodType?: string | null;
  logoDataUrl?: string | null;
}

interface WorkerLabelPrintSheetProps {
  labels: LabelData[];
}

/**
 * Hidden HTML label sheet rendered in-page for window.print().
 * Each label is sized at 62mm x 100mm matching the previous jsPDF layout.
 * All text is rotated -90° to match vertical label orientation.
 */
export const WorkerLabelPrintSheet: React.FC<WorkerLabelPrintSheetProps> = ({ labels }) => {
  if (labels.length === 0) return null;

  return (
    <div id="label-print-area" className="label-print-area">
      {labels.map((label, idx) => (
        <div key={idx} className="label-page">
          {/* Border */}
          <div className="label-border">
            {/* Logo top-right */}
            {label.logoDataUrl && (
              <img
                src={label.logoDataUrl}
                alt="Logo"
                className="label-logo"
              />
            )}

            {/* Rotated texts - positioned from right to left like jsPDF layout */}
            <div className="label-text label-name" style={{ fontSize: getFontSize(label.displayName) }}>
              {label.displayName}
            </div>

            <div className="label-text label-job">
              {label.jobFunctionName}
            </div>

            <div className="label-text label-company">
              {label.companyName}
            </div>

            <div className="label-text label-project" style={{ fontSize: getProjectFontSize(label.projectName) }}>
              {label.projectName}
            </div>

            <div className="label-text label-project-type">
              {label.projectType}
            </div>

            {/* Powered by */}
            <div className="label-text label-powered">
              Powered by Googlemarine
            </div>

            {/* Circle with code */}
            <div className="label-code-circle">
              <span className="label-code-text">{label.code}</span>
            </div>

            {/* Blood type */}
            {label.bloodType && (
              <div className="label-blood-type">
                <span className="label-blood-label">Tipo Sanguíneo</span>
                <span className="label-blood-value">{label.bloodType}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

function getFontSize(name: string): string {
  if (name.length > 25) return '8pt';
  if (name.length > 20) return '10pt';
  if (name.length > 15) return '12pt';
  return '16pt';
}

function getProjectFontSize(name: string): string {
  if (name.length > 40) return '9pt';
  if (name.length > 30) return '10pt';
  if (name.length > 20) return '12pt';
  return '14pt';
}

export type { LabelData };
