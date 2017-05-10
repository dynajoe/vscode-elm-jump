port module App exposing (..)

import Json.Decode
import Debug
import Ast
import Ast.Expression exposing (..)
import Ast.Statement exposing (..)
import Json.Decode as JD
import Json.Encode as JE


-- MODEL


type alias Model =
    String


init : ( Model, Cmd Msg )
init =
    ( "Foo", Cmd.none )



-- MESSAGES


type Msg
    = ParseInput String



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ParseInput input ->
            ( model, parseOutput <| tree input )



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch [ parseInput ParseInput ]


port parseInput : (String -> msg) -> Sub msg


port parseOutput : List JE.Value -> Cmd msg


type Symbol
    = Symbol
        { kind : String
        , name : String
        , children : List Symbol
        }


statement : Statement -> Maybe JE.Value
statement s =
    case s of
        FunctionTypeDeclaration a b ->
            Just <|
                JE.object
                    [ ( "kind"
                      , JE.string "FunctionTypeDeclaration"
                      )
                    , ( "name", JE.string a )
                    , ( "children", JE.list [] )
                    ]

        FunctionDeclaration a b c ->
            Just <|
                JE.object
                    [ ( "kind"
                      , JE.string "FunctionDeclaration"
                      )
                    , ( "name", JE.string a )
                    , ( "children", JE.list [] )
                    ]

        ImportStatement a b c ->
            Just <|
                JE.object
                    [ ( "kind"
                      , JE.string "ImportStatement"
                      )
                    , ( "name", JE.string <| String.join "." a )
                    , ( "children", JE.list [] )
                    ]

        PortModuleDeclaration a b ->
            Just <|
                JE.object
                    [ ( "kind"
                      , JE.string "PortModuleDeclaration"
                      )
                    , ( "name", JE.string <| String.join "." a )
                    , ( "children", JE.list [] )
                    ]

        _ ->
            Nothing


tree : String -> List JE.Value
tree m =
    case Ast.parse m of
        Ok ( _, _, statements ) ->
            List.filterMap statement statements

        err ->
            []


main : Program Never Model Msg
main =
    Platform.program
        { init = init
        , update = update
        , subscriptions = subscriptions
        }
