const CONFIG = {   
   ownerID: "459555796506771456",
   name: "charlies",
   settings: {            
      outburstThreshold: 0.005,      /* 0..1 chance of speaking without being spoken to */
      numberOfLines: 1,              /* # of lines to speak at once */
      angerLevel: 0.5,               /* 0..1 chance of yelling (initially) */
      angerIncrease: 1.25,           /* multiplier to increase anger if yelled at */
      angerDecrease: 0.75,           /* multiplier to decrease anger if not yelled at */
      recursion: 1,                  /* # of times to think about a line before responding */
      conversationTimeLimit: 3,      /* number of seconds to wait for a response */
      conversationMemoryLength: 600, /* number of seconds before forgetting a topic */
   }
}
export { CONFIG };