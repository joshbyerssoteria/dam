// Hand-maintained database types matching supabase/migrations.
// Regenerate with `npx supabase gen types typescript` once the project is
// linked, and replace this file.

export type AppRole = "admin" | "editor" | "viewer";
export type KitAssetType = "file" | "palette" | "font";
export type ShareTargetType = "kit" | "folder";

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
}

export type SpaceRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export type FileRow = {
  id: string;
  s3_key: string;
  s3_bucket: string;
  mime_type: string;
  original_filename: string;
  file_size: number;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type KitRow = {
  id: string;
  space_id: string;
  slug: string;
  name: string;
  description: string | null;
  share_token: string | null;
  share_password_hash: string | null;
  share_expires_at: string | null;
  cover_image_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type KitAssetRow = {
  id: string;
  kit_id: string;
  asset_type: KitAssetType;
  asset_id: string;
  sort_order: number;
  created_at: string;
}

export type PaletteRow = {
  id: string;
  kit_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export type ColorRow = {
  id: string;
  palette_id: string;
  hex: string;
  name: string | null;
  role: string | null;
  rgb: string | null;
  cmyk: string | null;
  pantone: string | null;
  sort_order: number;
}

export type FontRow = {
  id: string;
  kit_id: string;
  family: string;
  foundry: string | null;
  license_note: string | null;
  sort_order: number;
  created_at: string;
}

export type FontFileRow = {
  id: string;
  font_id: string;
  weight: number | null;
  style: string | null;
  file_id: string;
}

export type FolderRow = {
  id: string;
  space_id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  share_token: string | null;
  share_password_hash: string | null;
  share_expires_at: string | null;
  cover_photo_id: string | null;
  sort_order: number;
  created_at: string;
}

export type PhotoRow = {
  id: string;
  folder_id: string;
  file_id: string;
  ai_tags: string[];
  ai_caption: string | null;
  ai_scene: string | null;
  event_type: string | null;
  embedding: string | null; // pgvector serializes as string over the wire
  taken_at: string | null;
  photographer_name: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type ShareLinkRow = {
  id: string;
  token: string;
  target_type: ShareTargetType;
  target_id: string;
  expires_at: string | null;
  password_hash: string | null;
  download_count: number;
  created_by: string | null;
  created_at: string;
}

export type UploadTokenRow = {
  id: string;
  token: string;
  target_folder_id: string;
  expires_at: string | null;
  max_files: number | null;
  used_count: number;
  photographer_name: string | null;
  photographer_email: string | null;
  instructions: string | null;
  created_by: string | null;
  created_at: string;
}

export type DownloadLogRow = {
  id: string;
  share_token: string;
  file_id: string | null;
  ip_hash: string | null;
  downloaded_at: string;
}

export type UploadLogRow = {
  id: string;
  upload_token: string;
  file_id: string | null;
  uploaded_at: string;
}

export type SearchPhotosResult = {
  photo_id: string;
  semantic_score: number;
  keyword_score: number;
  score: number;
}

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

// photos carries explicit FK metadata so embedded selects like
// .select("*, files(*)") type correctly.
type PhotosTableDef = {
  Row: PhotoRow;
  Insert: Partial<PhotoRow>;
  Update: Partial<PhotoRow>;
  Relationships: [
    {
      foreignKeyName: "photos_file_id_fkey";
      columns: ["file_id"];
      isOneToOne: false;
      referencedRelation: "files";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "photos_folder_id_fkey";
      columns: ["folder_id"];
      isOneToOne: false;
      referencedRelation: "folders";
      referencedColumns: ["id"];
    },
  ];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      spaces: TableDef<SpaceRow>;
      files: TableDef<FileRow>;
      kits: TableDef<KitRow>;
      kit_assets: TableDef<KitAssetRow>;
      palettes: TableDef<PaletteRow>;
      colors: TableDef<ColorRow>;
      fonts: TableDef<FontRow>;
      font_files: TableDef<FontFileRow>;
      folders: TableDef<FolderRow>;
      photos: PhotosTableDef;
      share_links: TableDef<ShareLinkRow>;
      upload_tokens: TableDef<UploadTokenRow>;
      download_log: TableDef<DownloadLogRow>;
      upload_log: TableDef<UploadLogRow>;
    };
    Views: Record<string, never>;
    Functions: {
      search_photos: {
        Args: {
          query_embedding?: string | null;
          query_tags?: string[];
          semantic_weight?: number;
          match_limit?: number;
        };
        Returns: SearchPhotosResult[];
      };
      current_app_role: {
        Args: Record<string, never>;
        Returns: AppRole;
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
