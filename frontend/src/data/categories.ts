export interface Category {
  id: string
  label: string
  meshType: 'sofa' | 'bed' | 'table' | 'desk'
  subcategories: string[]
  color: string
  position: [number, number, number]
  order?: number
  glbUrl?: string | null
}

export interface Subcategory {
  id: string
  categoryId: string
  label: string
  order?: number
}

export const CATEGORIES: Category[] = [
  {
    id: 'living',
    label: 'Living Room',
    meshType: 'sofa',
    subcategories: ['Seating', 'Tables'],
    color: '#7c6af7',
    position: [-4, 0, -3],
  },
  {
    id: 'bedroom',
    label: 'Bedroom',
    meshType: 'bed',
    subcategories: ['Beds', 'Storage'],
    color: '#f77c9c',
    position: [4, 0, -3],
  },
  {
    id: 'dining',
    label: 'Dining Room',
    meshType: 'table',
    subcategories: ['Tables', 'Chairs'],
    color: '#7cf7c6',
    position: [-4, 0, 3],
  },
  {
    id: 'office',
    label: 'Office',
    meshType: 'desk',
    subcategories: ['Desks', 'Shelving'],
    color: '#f7c67c',
    position: [4, 0, 3],
  },
]
