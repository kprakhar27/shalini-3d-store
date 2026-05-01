export interface Variant {
  label: string
  color: string
}

export interface Product {
  id: string
  name: string
  price: number
  description: string
  variants: Variant[]
  // Firestore-backed fields (optional so static fallback array still type-checks)
  categoryId?: string
  subcategoryId?: string
  imageUrls?: string[]
  glbUrl?: string | null
  thumbnailUrl?: string | null
  generationStatus?: 'none' | 'pending' | 'processing' | 'completed' | 'failed'
  generationJobId?: string | null
  published?: boolean
}

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Cloud Sofa',
    price: 1299,
    description: 'Deep-seat three-seater with feather cushions',
    variants: [
      { label: 'Slate Blue', color: '#5b7aa8' },
      { label: 'Warm Grey', color: '#9e9e8e' },
      { label: 'Forest Green', color: '#4a7c59' },
    ],
  },
  {
    id: 'p2',
    name: 'Arc Loveseat',
    price: 849,
    description: 'Curved silhouette with velvet upholstery',
    variants: [
      { label: 'Dusty Rose', color: '#c47a7a' },
      { label: 'Ivory', color: '#d4cfc4' },
      { label: 'Midnight', color: '#2c2c44' },
    ],
  },
  {
    id: 'p3',
    name: 'Mod Armchair',
    price: 649,
    description: 'Mid-century modern with walnut legs',
    variants: [
      { label: 'Caramel', color: '#c4894a' },
      { label: 'Teal', color: '#3a8c8c' },
      { label: 'Charcoal', color: '#4a4a5a' },
    ],
  },
  {
    id: 'p4',
    name: 'Loft Sectional',
    price: 2199,
    description: 'L-shaped sectional with chaise extension',
    variants: [
      { label: 'Sand', color: '#c8b89a' },
      { label: 'Slate', color: '#6a7a8a' },
      { label: 'Olive', color: '#7a8a5a' },
    ],
  },
  {
    id: 'p5',
    name: 'Nest Chair',
    price: 479,
    description: 'Egg-shaped accent chair with swivel base',
    variants: [
      { label: 'Burnt Orange', color: '#c45a2a' },
      { label: 'Plum', color: '#7a4a8a' },
      { label: 'Cream', color: '#e0d8ca' },
    ],
  },
  {
    id: 'p6',
    name: 'Drift Sofa',
    price: 1599,
    description: 'Low-profile sofa with integrated side table',
    variants: [
      { label: 'Ocean Blue', color: '#3a6a9a' },
      { label: 'Rose Taupe', color: '#b89a8a' },
      { label: 'Sage', color: '#7a9a7a' },
    ],
  },
]
