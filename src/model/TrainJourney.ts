interface Stop {
  stationId: number;
  stationName: string;
  track: string;
  arrivalTime: number;
  departureTime: number;
}

export interface TrainJourney {
  trainType: string;
  trainId: string;
  stops: Stop[];
}
