export interface Sucursal {
  id: string;
  name: string;
  address: string;
  /** Texto de búsqueda usado para ubicar la sucursal en Google Maps */
  mapsQuery: string;
  phone?: string;
  /**
   * Coordenadas del local; son el origen de la ruta de reparto, por lo que
   * deben coincidir con el pin que muestra /sucursales (Google resuelve el
   * mapsQuery a este punto). Si cambia una dirección, actualizar ambos.
   */
  lat: number;
  lng: number;
}

export const sucursales: Sucursal[] = [
  {
    id: "don-ramon",
    name: "Avícola Don Ramón",
    address: "Avenida Las Américas 4117, Paraná, Entre Ríos",
    mapsQuery: "Avenida Las Américas 4117, Paraná, Entre Ríos, Argentina",
    lat: -31.7770076,
    lng: -60.5200741,
  },
];
