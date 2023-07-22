// Represents a train connection
import { transformTrainJourneys } from "./transformTrainJourneys";

export class CSAConnection {
  trainId: string;
  departureStation: number;
  departureTrackId: string;
  departureTimestamp: number;
  arrivalStation: number;
  arrivalTrackId: string;
  arrivalTimestamp: number;

  constructor({
    trainId,
    departureStation,
    departureTrackId,
    arrivalStation,
    arrivalTrackId,
    departureTimestamp,
    arrivalTimestamp,
  }: CSAConnection) {
    this.trainId = trainId;
    this.departureStation = departureStation;
    this.departureTrackId = departureTrackId;
    this.departureTimestamp = departureTimestamp;
    this.arrivalStation = arrivalStation;
    this.arrivalTrackId = arrivalTrackId;
    this.arrivalTimestamp = arrivalTimestamp;
  }
}

// Represents a timetable of train connections
class Timetable {
  connections: CSAConnection[];

  constructor(connections: CSAConnection[]) {
    // Transform the connection objects into instances of CSAConnection
    this.connections = connections.map((connection) => new CSAConnection(connection));
  }
}

// Represents the earliest arrival at a station
interface EarliestArrival {
  timestamp: number;
  inConnections: CSAConnection[];
}

export class CSA {
  private timetable: Timetable;
  private earliestArrivals: EarliestArrival[];

  constructor() {
    // Initialize the timetable and earliestArrival
    this.timetable = new Timetable([]);
    this.earliestArrivals = [];

    // Load train journeys asynchronously and update the timetable and earliestArrival
    Promise.resolve(transformTrainJourneys()).then((connections) => {
      console.log("CSA connections", connections.length);
      this.timetable = new Timetable(connections);
      this.earliestArrivals = [];

      return this;
    });
  }

  // Update the earliest arrival at a station
  updateEarliestArrival(stationIndex: number, arrival: EarliestArrival) {
    this.earliestArrivals[stationIndex] = {
      timestamp: arrival.timestamp,
      inConnections: arrival.inConnections,
    };
  }

  // Main loop of the Connection Scan Algorithm (CSA)
  mainLoop() {
    const THIRTY_MINUTES = 30 * 60;

    for (let connection of this.timetable.connections) {
      // Get the earliest arrival at the departure station
      const earliestArrivalDeparture = this.earliestArrivals[connection.departureStation];
      const earliestArrivalDepartureInConnections =
        this.earliestArrivals[connection.departureStation].inConnections;

      // Check if an additional transfer time is needed
      const needsAdditionalTime =
        earliestArrivalDepartureInConnections.length > 0
          ? connection.trainId !==
            earliestArrivalDepartureInConnections[earliestArrivalDepartureInConnections.length - 1].trainId
          : false;

      // Calculate the transfer time based on the needsAdditionalTime flag
      const transferTime = needsAdditionalTime ? THIRTY_MINUTES : 0;

      // Update the earliest arrival at the arrival station if a faster route is found
      if (
        connection.departureTimestamp >= earliestArrivalDeparture.timestamp + transferTime &&
        connection.arrivalTimestamp < this.earliestArrivals[connection.arrivalStation].timestamp
      ) {
        const arrivalCopy = this.earliestArrivals[connection.arrivalStation];
        const newInConnections = [...arrivalCopy.inConnections, connection];

        this.updateEarliestArrival(connection.arrivalStation, {
          timestamp: connection.arrivalTimestamp,
          inConnections: newInConnections,
        });
      }
    }
  }

  // Get the fastest routes from the departure station to the arrival station
  getFastestRoutes(
    departureStation: number,
    arrivalStation: number,
    departureTimestamp: number,
    numRoutes: number
  ): CSAConnection[][] | "no_solution" {
    const MAX_STATIONS = 250;

    // Initialize the earliest arrival array with high timestamps and empty connections
    this.earliestArrivals = new Array(MAX_STATIONS).fill({
      timestamp: Number.MAX_VALUE,
      inConnections: [],
    });

    // Set the earliest arrival at the departure station as the departure timestamp
    this.earliestArrivals[departureStation] = {
      timestamp: departureTimestamp,
      inConnections: [],
    };

    // Perform the main loop multiple times to find multiple routes
    for (let i = 0; i < numRoutes; i++) {
      this.mainLoop();
    }

    const result = this.earliestArrivals[arrivalStation].inConnections;

    // Check if no solution is found
    if (result.length === 0) {
      return "no_solution";
    }

    const routes: CSAConnection[][] = [];

    // Construct the routes by following the connections backwards
    for (let route of result) {
      const journey: CSAConnection[] = [];
      let currentConnection: CSAConnection | null = route;

      // Traverse the connections from arrival to departure, adding them to the journey
      while (currentConnection !== null) {
        journey.push(currentConnection);
        currentConnection =
          this.earliestArrivals[currentConnection.departureStation].inConnections.find(
            (connection) =>
              connection.arrivalStation === currentConnection?.departureStation &&
              connection.arrivalTimestamp < currentConnection?.departureTimestamp
          ) ?? null;
      }

      journey.reverse();
      routes.push(journey);
    }

    // Sort the routes based on the arrival timestamp of the last connection
    return routes.sort((a, b) => a[a.length - 1].arrivalTimestamp - b[b.length - 1].arrivalTimestamp);
  }
}
