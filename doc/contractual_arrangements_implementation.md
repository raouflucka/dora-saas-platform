# DORA SaaS — Implementation Plan: Contractual Arrangements Module (RT.02)

Le module "Arrangements Contractuels" est au cœur de la directive DORA. Il permet l'enregistrement des contrats TIC conclus entre les entités financières et les prestataires de services TIC. Ce plan détaille le développement backend, frontend, l'intégration des très nombreuses clés étrangères (lookups) associés à ce module, et la collaboration inter-rôle en temps réel.

## 1. Rappel Pédagogique (Exigences DORA)
- **Objectif** : Tenir un registre de tous les contrats TIC, avec le niveau de dépendance, la criticité, et la localisation des données.
- **Relations** : Un contrat relie de manière centrale : (1) Une Entité Financière, (2) Un Prestataire TIC principal, (3) Des Tables de Référence (Type de service, Niveau de Dépendance, Criticité des Données, Pays).

## 2. Vue d'ensemble des Changements

### Backend : NestJS
Nous procéderons à la génération d'un module REST complet, qui contiendra un service Prisma gérant la création/édition des contrats tout en validant le `tenant_id`.
- **Module** : `ContractualArrangements`
- **Controller** : `POST`, `GET`, `PATCH`, `DELETE` sur la route `/contractual-arrangements`
- **DTOs** : Les Data Transfer Objects qui intègreront plus de 20 champs (dates, booléens, et uuid des références).
- **Service** : Récupérer les contrats en incluant via `Prisma` toutes les relations contextuelles (`provider`, `financialEntity`, `ictServiceType`, `relianceLevel`, etc.).

### Frontend : React + Vite + UI
Création d'une nouvelle page robuste pour la gestion des contrats.
- **Grille de données** : Affichera la référence du contrat, le type, la date de début/fin, le prestataire, et le fournisseur. Formattage adéquat des dates.
- **Formulaire d'Ajout/Édition** :
  - **Lookups Locaux** : Pays, Devises.
  - **Nouveaux Lookups à intégrer** : Entités Financières de l'utilisateur, Prestataires TIC de l'utilisateur, Type de Service TIC, Niveau de Confiance (Reliance), Sensibilité des données.
  - **Organisation UI** : Compte tenu du nombre de champs (15+), le formulaire utilise un affichage flexible multi-colonnes.
  - **Collaboration native** : Intégration de `CommentsPanel.tsx` permettant à l'Auditeur/Editeur et à l'Analyste d'échanger directement sur un Arrangement Contractuel via URL deep-linking (`?openContractId=...`).

## 3. Détails d'Implémentation (`Modifications`)

### Composant Backend
#### [NEW] [contractual-arrangements.module.ts](file:///Volumes/D/dora_saas/backend/src/contractual-arrangements/contractual-arrangements.module.ts)
Définit le nouveau module d'API.

#### [NEW] [contractual-arrangements.controller.ts](file:///Volumes/D/dora_saas/backend/src/contractual-arrangements/contractual-arrangements.controller.ts)
Gère le routage et sécurise l'accès.

#### [NEW] [contractual-arrangements.service.ts](file:///Volumes/D/dora_saas/backend/src/contractual-arrangements/contractual-arrangements.service.ts)
Traite la logique d'enregistrement métier et isole via `tenantId`.

#### [MODIFY] [reference.service.ts](file:///Volumes/D/dora_saas/backend/src/reference/reference.service.ts)
Ajout des endpoints exposant les nomenclatures DORA restantes (`reliance_levels`, `data_sensitivity_levels`, `ict_service_types`).

### Composant Frontend
#### [NEW] [contractualArrangementsApi.ts](file:///Volumes/D/dora_saas/frontend/src/api/contractualArrangements.ts)
Client Axios mappant les actions CRUD.

#### [NEW] [ContractualArrangements.tsx](file:///Volumes/D/dora_saas/frontend/src/pages/ContractualArrangements.tsx)
La page composant principal comprenant le tableau d'affichage, la barre de recherche et la Modale Formulaire.

#### [MODIFY] [DashboardLayout.tsx](file:///Volumes/D/dora_saas/frontend/src/layouts/DashboardLayout.tsx)
Ajout d'une entrée de navigation pour la page "Contractual Arrangements".

## 4. Verification Plan
1. Déployer les endpoints backend (Contrats + Update Reference Data).
2. Vérifier que la grille du frontend s'affiche et récupère bien la liste vide (statut 200).
3. Simuler la création d'un contrat test liant l'Entité Test avec le Fournisseur Test (Conformité EBA RT.02). 
4. Valider l'insertion dans la base de données réelle de l'utilisateur via Prisma.
5. Confirmer que la modification et suppression d'un contrat sont viables et mises à jour sur l'IHM.
6. Vérifier la réception des notifications push (deep-linking) entre les utilisateurs Analyst et Editor via le système de discussion `CommentsPanel`.
