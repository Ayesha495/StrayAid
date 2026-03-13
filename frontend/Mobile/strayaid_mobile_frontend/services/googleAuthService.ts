import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: '<998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com>',
    });

    return { request, response, promptAsync };
};