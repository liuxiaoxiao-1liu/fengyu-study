export type PublicLetter = {
  id: string;
  name: string;
  station: string;
  message: string;
  tag: string;
  reply: string;
  replied_at: string | null;
  created_at: string;
};

export type StatsPayload = {
  ok?: boolean;
  replyRate?: number;
  letters?: {
    publicTotal?: number;
    approved?: number;
    publicReplied?: number;
  };
};

export type LetterDraft = {
  name: string;
  station: string;
  tag: string;
  message: string;
  private: boolean;
  website: string;
};
