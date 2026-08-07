import WebSocket from "ws";
import { neonConfig } from "@neondatabase/serverless";

neonConfig.webSocketConstructor = WebSocket;
