# Piano di Refactoring - Controller

## Controller da refactorizzare

### 1. CharacterApprovalController (1606 righe)
**Percorso**: `modules/admin/controllers/CharacterApprovalController.ts`

**Servizi da estrarre**:
- `CharacterApprovalService` - logica di approvazione/rifiuto personaggi
- `FaceClaimService` - gestione prestavolto e ricerca duplicati
- `BulkOperationService` - operazioni bulk (approve/reject/delete in massa)

**Metodi da spostare**:
- `submitCharacterReview` → `CharacterApprovalService.review()`
- `getDuplicateFaceClaims` → `FaceClaimService.findDuplicates()`
- `bulkApprove/bulkReject/bulkDelete` → `BulkOperationService.execute()`

### 2. UserManagementController (1300 righe)
**Percorso**: `modules/admin/controllers/UserManagementController.ts`

**Servizi da estrarre**:
- `UserBanService` - logica ban/unban utenti
- `UserProfileService` - gestione profili e ruoli
- `BulkUserOperationService` - operazioni bulk utenti

### 3. SystemConfigController (830 righe)
**Percorso**: `modules/admin/controllers/SystemConfigController.ts`

**Servizi da estrarre**:
- `AuditLogService` - query e filtro audit log
- `SystemConfigService` - gestione configurazioni sistema
- `MaintenanceModeService` - attivazione/disattivazione manutenzione

## Pattern da seguire

I servizi dovrebbero:
1. Essere classi statiche o singleton
2. Gestire la logica di business e le query DB
3. Restituire risultati tipizzati (non Response)
4. Essere testabili indipendentemente dai controller
5. Essere posizionati in `modules/admin/services/`

## Priorita

1. Alta: `CharacterApprovalService` (usato frequentemente)
2. Media: `UserBanService` (operazioni critiche)
3. Bassa: `SystemConfigService` (usato raramente)
