/**
 * Types de la base de données, alignés sur supabase/migrations/0001_init.sql
 * et 0002_photo_fond.sql.
 *
 * Ils sont écrits à la main (pas de CLI Supabase installée). À régénérer avec
 * `supabase gen types typescript --project-id <id>` dès que la CLI sera
 * disponible, ou à mettre à jour à chaque nouvelle migration.
 *
 * Aucun secret ici : uniquement la forme des données publiques du schéma.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      cartes: {
        Row: {
          id: string;
          organisateur: string;
          modele: string;
          contenu: Json;
          photo_fond_chemin: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organisateur: string;
          modele: string;
          contenu?: Json;
          photo_fond_chemin?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organisateur?: string;
          modele?: string;
          contenu?: Json;
          photo_fond_chemin?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          carte_id: string;
          nom: string;
          code: string;
          places: number;
          date_limite: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          carte_id: string;
          nom: string;
          code: string;
          places?: number;
          date_limite?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          carte_id?: string;
          nom?: string;
          code?: string;
          places?: number;
          date_limite?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_carte_id_fkey";
            columns: ["carte_id"];
            isOneToOne: false;
            referencedRelation: "cartes";
            referencedColumns: ["id"];
          },
        ];
      };
      reponses: {
        Row: {
          id: string;
          invite_id: string;
          statut: Database["public"]["Enums"]["statut_reponse"];
          nombre_personnes: number | null;
          date_reponse: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invite_id: string;
          statut?: Database["public"]["Enums"]["statut_reponse"];
          nombre_personnes?: number | null;
          date_reponse?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invite_id?: string;
          statut?: Database["public"]["Enums"]["statut_reponse"];
          nombre_personnes?: number | null;
          date_reponse?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reponses_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: true;
            referencedRelation: "invites";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      // La contrainte SQL est un check, pas un type enum : on reproduit ici
      // les valeurs autorisées pour typer les réponses côté TypeScript.
      statut_reponse: "en_attente" | "vient" | "ne_vient_pas";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Carte = Database["public"]["Tables"]["cartes"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type Reponse = Database["public"]["Tables"]["reponses"]["Row"];
