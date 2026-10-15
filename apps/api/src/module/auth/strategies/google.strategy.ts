import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigProvider } from '@src/config';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  pictureUrl?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: ConfigProvider.auth.google.clientId,
      clientSecret: ConfigProvider.auth.google.clientSecret,
      callbackURL: ConfigProvider.auth.google.redirectUri,
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Google profile email missing'));
    }
    const result: GoogleProfile = {
      googleId: profile.id,
      email,
      name: profile.displayName,
      pictureUrl: profile.photos?.[0]?.value,
    };
    done(null, result);
  }
}
