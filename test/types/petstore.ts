// Generated from test/fixtures/specs/petstore.yaml with the module's default openapi-typescript options.
// The type tests (test/types/*.test-d.ts) run against this real generator output.
// Regenerate with: UPDATE_FIXTURES=1 npx vitest run test/generated-types.test.ts

export interface paths {
    "/owners/{ownerId}/pets/{petId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ownerId: number;
                petId: string;
            };
            cookie?: never;
        };
        get: operations["getOwnerPet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listPets"];
        put?: never;
        post: operations["createPet"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pets/{petId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                petId: string;
            };
            cookie?: never;
        };
        get: operations["showPetById"];
        put?: never;
        post?: never;
        delete: operations["deletePet"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/pets/{petId}/photo": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                petId: string;
            };
            cookie?: never;
        };
        get: operations["getPetPhoto"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["searchPets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["postStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Error: {
            code: number;
            message: string;
        };
        NewPet: {
            name: string;
            tag?: string;
        };
        Pet: {
            id: string;
            name: string;
            tag?: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getOwnerPet: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                ownerId: number;
                petId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description pet of owner */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Pet"];
                };
            };
        };
    };
    listPets: {
        parameters: {
            query?: {
                limit?: number;
                tag?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description all pets */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Pet"][];
                };
            };
        };
    };
    createPet: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NewPet"];
            };
        };
        responses: {
            /** @description created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Pet"];
                };
            };
            /** @description invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    showPetById: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                petId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description one pet */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Pet"];
                };
            };
            /** @description not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    deletePet: {
        parameters: {
            query?: never;
            header: {
                "X-Request-Id": string;
            };
            path: {
                petId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getPetPhoto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                petId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description photo */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
        };
    };
    searchPets: {
        parameters: {
            query: {
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        results: components["schemas"]["Pet"][];
                    };
                };
            };
        };
    };
    postStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ok */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        queued: boolean;
                    };
                };
            };
        };
    };
}
