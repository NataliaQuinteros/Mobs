import type { Business } from '../../shared/types.ts'

export const mockBusinesses: Business[] = [
  {
    id: 'node/1',
    name: 'Café Central',
    website: 'https://cafecentral.example',
    lat: 46.539, lon: 6.578, distanceKm: 0.3,
    careersUrl: 'https://cafecentral.example/work-with-us',
    postings: [],
  },
  {
    id: 'way/2',
    name: 'Northwind Software',
    website: 'https://northwind.example',
    lat: 46.532, lon: 6.571, distanceKm: 0.8,
    careersUrl: 'https://northwind.example/careers',
    postings: [
      { title: 'Frontend Developer', url: 'https://northwind.example/careers/frontend', location: 'Madrid' },
      { title: 'QA Engineer', url: 'https://northwind.example/careers/qa', location: 'Remote' },
    ],
  },
  {
    id: 'node/3',
    name: 'Green Market',
    website: 'https://greenmarket.example',
    lat: 46.546, lon: 6.59, distanceKm: 1.4,
    careersUrl: 'https://greenmarket.example/jobs',
    postings: [{ title: 'Store Assistant', url: 'https://greenmarket.example/jobs/store-assistant' }],
  },
]
