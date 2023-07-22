import { CSAConnection } from "./ConnectionScanAlgorithm";
import {TrainJourney} from "./model/TrainJourney";

// Constant representing the number of seconds in a day
const SECONDS_PER_DAY = 24 * 60 * 60;

// Retrieve train connections from the database
const getConnections = async (): Promise<TrainJourney[]> => {
  const connections = (await MongooseTrainConnection.find().sort({
    "trainStops.departureTime": 1,
  })) as DatabaseTrainConnection[];

  console.log("connections", connections.length);

  // Map and transform the connections and stops
  const mappedConnections = await Promise.all(
    connections.map(async ({ trainId, trainType, trainStops }) => {
      return {
        trainId,
        trainType,
        stops: await Promise.all(
          trainStops.map(async (stop) => {
            const { stationId, departureTime, arrivalTime, track } = stop;

            // Retrieve station information from the database
            const station = (await MongooseTrainStation.findById(stationId)) as DatabaseTrainStation;

            return {
              stationId: station.csaIndex,
              stationName: station.name,
              arrivalTime,
              departureTime,
              track,
            };
          })
        ),
      };
    })
  );

  // Create connections for the next day for journeys that extend beyond midnight
  const test = mappedConnections.map((connection) => {
    const nextDayConnection = {
      ...connection,
      stops: connection.stops.map((stop) => ({
        ...stop,
        arrivalTime: stop.arrivalTime + SECONDS_PER_DAY,
        departureTime: stop.departureTime + SECONDS_PER_DAY,
      })),
    };

    return [connection, nextDayConnection];
  });

  return test.flat(1);
};

// Transform retrieved train journeys into CSAConnection format
export const transformTrainJourneys = async (): Promise<CSAConnection[]> => {
  // Retrieve train connections from the database
  const connections = await getConnections();

  // Transform connections into CSAConnection format
  const journeys = connections.map((trainJourney) => {
    const { stops } = trainJourney;

    // Create connections between consecutive stops
    return stops
      .map((currentStop, index) => {
        if (index === stops.length - 1) {
          return null;
        }

        const nextStop = stops[index + 1];

        return {
          trainId: trainJourney.trainId,
          departureStation: currentStop.stationId,
          departureTrackId: currentStop.track,
          arrivalStation: nextStop.stationId,
          arrivalTrackId: nextStop.track,
          departureTimestamp: currentStop.departureTime,
          arrivalTimestamp: nextStop.arrivalTime,
        };
      })
      .filter((connection) => connection !== null) as CSAConnection[];
  });

  // Flatten the resulting array of connections
  return journeys.reduce((acc, line) => [...acc, ...line], []);
};
