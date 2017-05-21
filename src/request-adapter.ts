import { Core } from "kamboja"
import * as Express from "express"
import * as Lodash from "lodash"
import * as Passport from "passport"
import { LoginUser } from "./login-user"
import * as Url from "url"


export class RequestAdapter implements Core.HttpRequest {
    httpVersion: string
    httpMethod: Core.HttpMethod
    headers: { [key: string]: string }
    cookies: { [key: string]: string }
    params: { [key: string]: string }
    body: any
    referrer: string
    url: Url.Url
    user: LoginUser
    route:string

    constructor(public request: Express.Request) {
        this.headers = request.headers
        this.cookies = request.cookies
        this.params = Lodash.assign(request.params, request.query) 
        this.body = request.body;
        this.httpVersion = request.httpVersion;
        this.httpMethod = <Core.HttpMethod>request.method;
        if (request && request.originalUrl)
            this.url = Url.parse(request.originalUrl);
        this.referrer = request.header("referrer");
        this.user = request.user;
        this.route = request.route;
    }

    private findCaseInsensitive(obj, key) {
        let keys = Object.keys(obj);
        for (let item of keys) {
            if (item.toLowerCase() == key.toLowerCase())
                return obj[item]
        }
    }

    getHeader(key: string): string {
        return this.findCaseInsensitive(this.headers, key)
    }

    getCookie(key: string): string {
        return this.findCaseInsensitive(this.cookies, key)
    }

    getParam(key: string): string {
        return this.findCaseInsensitive(this.params, key)
    }

    getAccepts(key: string|string[]): string | boolean {
        if(Array.isArray(key))
            return this.request.accepts(key) 
        else 
            return this.request.accepts(key)
    }

    isAuthenticated(): boolean {
        return this.request.isAuthenticated()
    }

    getUserRole(): string {
        if (this.user)
            return this.user.role
        else
            return
    }
}