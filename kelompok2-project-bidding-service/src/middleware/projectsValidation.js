import * as z from "zod"

export const createProjectSchema = z.object({
  proyek_id: z.uuid(),
  mitra_id: z.uuid(),
  judul_proyek: z.varchar().max(255),
  deskripsi_proyek: z.text().notEmpty(),
  requirements: z.text(),
  kuota_maksimal: z.number().int().positive().notEmpty(),
  status_proyek: z.enum(['Open','Full','Closed']),
})
