/**
 * Simple Plugin
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { PluginManager } from 'sn-plugin-lib';
import { loadSettings } from './components/Storage';
import { log } from './components/ConsoleLog';
import Setting from './Setting';
import App from './App';
import { checkPendingSettings } from './index';

function Navigator(): React.JSX.Element {
  log("main", "started");

  const [currentView, setCurrentView] = useState(
    checkPendingSettings() ? 'SETTING' : 'APP'
  );

  useEffect(() => {

    const subscription = DeviceEventEmitter.addListener('openSettings', () => {
      log("main", "openSettings event received");
      setCurrentView('SETTING');
    });

    const appSub = DeviceEventEmitter.addListener('openApp', () => {
      log("main", "openApp event received");
      setCurrentView('APP');
    });

    return () => {
      subscription.remove();
      appSub.remove();
    };
  }, []);

  //  const handleClose = () => {
  //    PluginManager.closePluginView();
  //  };

  log("main", `currentView: ${currentView}`);
  return currentView === "SETTING" ? <Setting /> : <App />;

};

export default Navigator;
