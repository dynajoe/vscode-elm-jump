//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../src/extension';
import * as Parser from '../src/parse'

const typeAliasExample_a = `type alias RequestBody =
    Maybe Request

type alias DoseEvent =
    { doseEventId : Maybe DoseEventId
    , deviceAssignmentId : DeviceAssignmentId
    , takenOn : Time.ZonedDateTime.ZonedDateTime
    , amount : Int
    , periodDate : Time.Date.Date
    , periodNumber : Int
    , timezone : Time.TimeZone.TimeZone
    , doseEventCorrection : Maybe DoseEventCorrection
}`

const typeAliasExample = `type alias Context =
    Maybe String


type alias Paged a =
    { body : List a
    , totalCount : Int
    , pageNumber : Int
    , pageSize : Int
    , context : Context
    }`

const importExample = `import Foo.Bar as X exposing (baz)`

const typeDeclaration1 = `type Visibility = All | Active | Completed`

suite('Parsing Tests', () => {
    test('type aliases', () => {
        const parse_result = Parser.parse(typeAliasExample)
        assert(parse_result.status)
    })

    test('import statements', () => {
        const parse_result = Parser.parse(importExample)
        assert(parse_result.status)
    })

    test('type declaration', () => {
        const parse_result = Parser.parse(typeDeclaration1)
        assert(parse_result.status)
    })
})