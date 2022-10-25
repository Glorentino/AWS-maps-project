import './App.css';


import React, {useState, useEffect} from 'react';

import Amplify, {Auth} from 'aws-amplify';

import { Signer } from "@aws-amplify/core";
import Location from "aws-sdk/clients/location";
import awsconfig from './aws-exports';
import Pin from './Pin'
import useInterval from './useInterval';

import ReactMapGL, { Marker,
  NavigationControl,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";



const mapName = "GloryMap";
const indexName = "GloryPlaceIndex";  // Name of place Index
const trackerName = "GloryTracker"; // Name of your tracker
const deviceID = "Device1";

Amplify.configure(awsconfig);



const transformRequest = (credentials) => (url, resourceType) => {

  if (resourceType === "Style" && !url?.includes("://")) {
    url = `https://maps.geo.${awsconfig.aws_project_region}.amazonaws.com/maps/v0/maps/${url}/style-descriptor`;
  }

  if (url?.includes("amazonaws.com")) {
    return {
      url: Signer.signUrl(url, {
        access_key: credentials.accessKeyId,
        secret_key: credentials.secretAccessKey,
        session_token: credentials.sessionToken,
      })
    };
  }
  return { url: url || ""};
};

function Header(props) {
  return (
    <div className="container">
      <div className="row">
        <div className="col-10">
          <h1>Glory Maps</h1>
        </div>
        <div className="col-2">
        
        </div>
      </div>
    </div>
  )
};


function Search (props) {
  
  const [place, setPlace] = useState('New York');

  const handleChange = (event) => {
    setPlace(event.target.value);
  }

  const handleClick = (event) => {
    event.preventDefault();
    props.searchPlace(place)
  }

  return (
  <div className="constainer">
    <div className="input-group">
      <input type="text" className="form-control form-control-lg" placeholder="Search for Places" aria-label="Place"
      aria-describedby="basic-addon2" value={ place } onChange={handleChange}/>
      <div className="input-group-append">
        <button onClick={ handleClick } className="btn btn-primary" type="submit">Search</button>
      </div>
    </div>
  </div>
  )
};

function Track(props){

  const handleClick = (event) =>{
      event.preventDefault();
      props.trackDevice()
  }

  return (
      <div className="container">
          <div className="input-group">
              <div className="input-group-append">
                  <button onClick={ handleClick } className="btn btn-primary" type="submit">Track</button>
              </div>
          </div>
      </div>
  )
}

const App = () => {
  const [credentials, setCredentials] = useState(null);

  const [viewport, setViewport] = useState({
    longitude: -73.971321, 
    latitude: 40.776676,
    zoom: 10,
  });

  const [client, setClient] = useState(null);
  
  const [marker, setMarker] = useState({
    longitude: -73.971321,
    latitude: 40.776676,
  });

  const [devPosMarkers, setDevPosMarkers] = useState([]);

  useEffect(() => {
    const fetchCredentials = async () => {
      setCredentials(await Auth.currentUserCredentials());
    };

    fetchCredentials();

    const createClient = async () => {
      const credentials = await Auth.currentCredentials();
      const client = new Location({
          credentials,
          region: awsconfig.aws_project_region,
      });
      setClient(client);
    }

    createClient();
  }, []);

  useInterval(() => {
    getDevicePosition();
  }, 30000); // provide device location every 30 seconds


  const searchPlace = (place) => {
    
    const params = {
      IndexName: indexName,
      Text: place,
    };

    client.searchPlaceIndexForText(params, (err, data) => {
      if (err) console.error(err);
      if (data) {

        const coordinates = data.Results[0].Place.Geometry.Point;
        setViewport({
          longitude: coordinates[0],
          latitude: coordinates[1],
          zoom: 10});
          
          setMarker({
            longitude: coordinates[0],
            latitude: coordinates[1],                 
          })
        return coordinates;
      }
    });
  }
  const getDevicePosition = () =>{
    setDevPosMarkers([]);

    var params = {
        DeviceId : deviceID,
        TrackerName : trackerName,
        StartTimeInclusive: "2022-05-02T20:33:44.060Z", // Any start time
        EndTimeExclusive: new Date()
    };
    client.getDevicePositionHistory(params, (err, data) => {
      if (err) console.log(err, err.stack);
      if (data) {
          console.log(data)
          const tempPosMarkers = data.DevicePositions.map( function (devPos, index) {
              
              return {
                  index: index, 
                  long: devPos.Position[0],
                  lat: devPos.Position[1]
              }
          });

          setDevPosMarkers(tempPosMarkers);

          const pos = tempPosMarkers.length -1;

          setViewport({
            longitude: tempPosMarkers[pos].long,
            latitude: tempPosMarkers[pos].lat,
            zoom: 5});

        }
      });
    }
  const trackerMarkers = React.useMemo(() => devPosMarkers.map(
    pos => (
        <Marker key={pos.index} longitude={pos.long} latitude={pos.lat} >
            <Pin text={pos.index+1} size={20}/>
        </Marker>
    )), [devPosMarkers]);

  return (
    
    <div className="App">
      <Header/>
      <div>
        <Search searchPlace = {searchPlace} /> 
      </div>
      <br/>
      <div>
        <Track trackDevice = {getDevicePosition}/>
      </div>
      <br/>
      <div>
      {credentials ? (
          <ReactMapGL
            {...viewport}
            width="100%"
            height="100vh"
            transformRequest={transformRequest(credentials)}
            mapStyle={mapName}
            onViewportChange={setViewport}w
          >
            <Marker
              longitude={marker.longitude}
              latitude={marker.latitude}
              offsetTop={-20}
              offsetLeft={-10}
            > 
            <Pin size={20}/>
            </Marker>

            {trackerMarkers}

            <div style={{ position: "absolute", left: 20, top: 20 }}>
              <NavigationControl showCompass={false} />
            </div>
            
          </ReactMapGL>
      ) : (
        <h1>Loading...</h1>
      )}
      </div>
    </div>
    
  );
}

export default App;
