module Api.Common exposing (..)

import Http exposing (Response, Error)
import Json.Decode exposing (Decoder)
import String
import Dict exposing (Dict)
import Result


type alias Path =
    String


type alias QueryParams =
    List ( String, String )


type alias PagingParams =
    { pageNumber : Int
    , pageSize : Int
    , context : Context
    }


type alias RequestBody =
    String


type alias Context =
    Maybe String


type alias Paged a =
    { body : List a
    , totalCount : Int
    , pageNumber : Int
    , pageSize : Int
    , context : Context
    }


getApiUrl : Path -> QueryParams -> String
getApiUrl path params =
    case params of
        [] ->
            path

        _ ->
            path ++ "?" ++ String.join "&" (List.map queryPair params)


queryPair : ( String, String ) -> String
queryPair ( key, value ) =
    queryEscape key ++ "=" ++ queryEscape value


queryEscape : String -> String
queryEscape string =
    String.join "+" (String.split "%20" (Http.encodeUri string))


paginationQueryParams : PagingParams -> List ( String, String )
paginationQueryParams params =
    [ ( "page", toString params.pageNumber )
    , ( "page_size", toString params.pageSize )
    ]
        ++ maybeQueryParam "context" params.context


maybeQueryParam : String -> Maybe String -> List ( String, String )
maybeQueryParam name =
    Maybe.withDefault [] << Maybe.map (List.singleton << (,) name)


get : String -> QueryParams -> Decoder a -> (Result Error a -> msg) -> Cmd msg
get path params decoder transformer =
    Http.request
        { method = "GET"
        , headers = []
        , url = getApiUrl path params
        , body = Http.emptyBody
        , expect = Http.expectJson decoder
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer


getWithHeaders : String -> QueryParams -> (Response String -> Result String a) -> (Result Error a -> msg) -> Cmd msg
getWithHeaders path params responseParser transformer =
    Http.request
        { method = "GET"
        , headers = []
        , url = getApiUrl path params
        , body = Http.emptyBody
        , expect = Http.expectStringResponse responseParser
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer


getPage : String -> QueryParams -> Decoder a -> (Result Error (Paged a) -> msg) -> Cmd msg
getPage path params decoder transformer =
    getWithHeaders path params (pagedResponseParser decoder) transformer


pagedResponseParser : Decoder a -> Response String -> Result String (Paged a)
pagedResponseParser decoder response =
    Result.map5
        Paged
        (Json.Decode.decodeString (Json.Decode.list decoder) response.body)
        (Result.andThen String.toInt <| Result.fromMaybe "unable to parse total count" <| Dict.get "x-total-count" response.headers)
        (Result.andThen String.toInt <| Result.fromMaybe "unable to parse page number" <| Dict.get "x-page-number" response.headers)
        (Result.andThen String.toInt <| Result.fromMaybe "unable to parse page size" <| Dict.get "x-page-size" response.headers)
        (Result.fromMaybe "unable to parse page context" <| Maybe.map (\content -> Just content) <| Dict.get "x-context" response.headers)


responseDecoder : ( Dict String String -> Result String a, a ) -> ( String -> Result String b, b ) -> (a -> b -> c) -> Response String -> Result String c
responseDecoder headerDecoderWithDefault bodyDecoderWithDefault combine response =
    let
        ( headerDecoder, defaultHeader ) =
            headerDecoderWithDefault

        ( bodyDecoder, defaultBody ) =
            bodyDecoderWithDefault

        header =
            Result.withDefault defaultHeader <| headerDecoder response.headers

        body =
            Result.withDefault defaultBody <| bodyDecoder response.body
    in
        Ok (combine header body)


delete : String -> (Result Error Bool -> msg) -> Cmd msg
delete path transformer =
    Http.request
        { method = "DELETE"
        , headers = []
        , url = getApiUrl path []
        , body = Http.emptyBody
        , expect = Http.expectStringResponse successOrFailResponse
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer


successOrFailResponse : Response String -> Result String Bool
successOrFailResponse response =
    if response.status.code >= 300 then
        Err "Fail"
    else
        Ok True


postWithNoResponse : String -> (Result Error Bool -> msg) -> Cmd msg
postWithNoResponse path transformer =
    Http.request
        { method = "POST"
        , headers = []
        , url = getApiUrl path []
        , body = Http.emptyBody
        , expect = Http.expectStringResponse successOrFailResponse
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer


postJson : String -> RequestBody -> Decoder a -> (Result Error a -> msg) -> Cmd msg
postJson path body decoder transformer =
    Http.request
        { method = "POST"
        , headers = []
        , url = getApiUrl path []
        , body = Http.stringBody "application/json" body
        , expect = Http.expectJson decoder
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer


post : String -> Decoder a -> (Result Error a -> msg) -> Cmd msg
post path decoder transformer =
    Http.request
        { method = "POST"
        , headers = []
        , url = getApiUrl path []
        , body = Http.emptyBody
        , expect = Http.expectJson decoder
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer


patchJson : String -> RequestBody -> Decoder a -> (Result Error a -> msg) -> Cmd msg
patchJson path body decoder transformer =
    Http.request
        { method = "PATCH"
        , headers = []
        , url = getApiUrl path []
        , body = Http.stringBody "application/json" body
        , expect = Http.expectJson decoder
        , timeout = Nothing
        , withCredentials = False
        }
        |> Http.send transformer
