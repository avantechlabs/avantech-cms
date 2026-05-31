// message form the cms uses to communicate with the iframe
export type CmsToSiteMessage =
  | { type: "cms:apply-fields"; fields: Record<string, string> }
  | { type: "cms:update-field"; fieldId: string; value: string }
  | { type: "cms:select-field"; fieldId: string }
  | { type: "cms:discover-fields" };

export type FieldData = {
  id: string;
  value: string;
  editable?: boolean;
  rect: { left: number; top: number; width: number; height: number };
};

export type SiteToCmsMessage =
  | { type: "cms:ready" }
  | { type: "cms:fields"; fields: FieldData[] }
  | { type: "cms:field-clicked"; fieldId: string };
