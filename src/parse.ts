var fs = require('fs');
var path = require('path');
var util = require('util');
var P = require('parsimmon');
import * as _ from 'lodash'

function commaSep(parser) {
  return P.sepBy(parser, token(comma));
}

var whitespace = P.regexp(/\s*/m);

function token(p) {
  return p.skip(whitespace)
}

var lbrace = token(P.string('{'));
var rbrace = token(P.string('}'));
var lparen = token(P.string('('));
var rparen = token(P.string(')'));
var comma = token(P.string(','));
var colon = token(P.string(':'));
var equal = token(P.string('='));
var pipe = token(P.string('|'));

var name = P.regexp(/[a-z][a-zA-Z0-9_]*/)
var upName = P.regexp(/[A-Z][a-zA-Z0-9_]*/)
var moduleName = P.sepBy(upName, P.string('.')).map(x => x.join('.'))

var exportList = lparen.then(
   P.alt(
      P.sepBy1(
         P.alt(name, upName), token(comma)
      ),
      token(P.string('..')).result('*'),
   )
).skip(rparen)

var exposingClause = token(P.string('exposing')).then(exportList).fallback([])

var moduleStatement = token(P.regexp(/(port )?module/))
  .then(P.seq(
     moduleName,
     exposingClause
  ))
  .map(([module_name, exposing]) => {
    return {
      kind: 'module',
      name: module_name,
      exposing: exposing,
    }
  })

var importStatement = token(P.string('import'))
   .then(P.seq(
      token(moduleName),
      token(P.string('as')).then(token(upName)).fallback(null),
      token(P.string('exposing')).then(exportList).fallback([]),
   ))
   .map(([name, alias, exposed]) => {
      return {
         kind: 'import',
         module: name,
         alias: alias,
         exposing: exposed,
      }
   })

var typeConstructor = P.sepBy(moduleName, token(P.string(' '))).skip(whitespace)

var typeRecordDefinition = P.lazy(function () {
      return lbrace.then(
         commaSep(
            P.seq(
               token(name).skip(colon),
               P.alt(
                  typeRecordDefinition,
                  typeConstructor
               )
            )
            .map(([name, type]) => {
               return {
                  name,
                  type
               }
            })
         )
      ).skip(rbrace)
   })

var typeAliasDefinition = P.alt(typeRecordDefinition, moduleName)

var typeAliasDeclaration = token(P.string('type alias'))
   .then(P.seq(
      token(upName).skip(equal),
      typeAliasDefinition
   ))
   .map(([name, definition]) => {
      return {
         kind: 'type_alias',
         name: name,
         definition: definition
      }
   })

var typeDeclaration = token(P.string('type'))
   .then(P.seq(
      token(upName).skip(equal),
      P.sepBy1(typeConstructor, pipe)
   ))
   .map(([name, constructors]) => {
      return {
         kind: 'type',
         name: name,
         constructors: constructors
      }
   })

var elmStatement = P.lazy(function () {
    return whitespace.then(
        P.seq(
          P.index,
          P.alt(
            moduleStatement,
            importStatement,
            typeDeclaration,
            typeAliasDeclaration,
            P.regexp(/.*\n/).result(null)
         )
       ).map(([position, value]) => {
          if (value) {
            return { ...value, position }
          }
       }).many()
    )
    .map(x => _.compact(x))
});

export interface Statement {
   kind: string
   position: { line: number, column: number, offset: number },
}

export interface ImportStatement extends Statement {
   module: string
   alias: string
   exposing: string | string[]
}

export interface NamedStatement extends Statement {
   name: string
}

export interface ElmParseResult {
   status: boolean
   value: Statement[]
}

export function parse(text: string): ElmParseResult {
   return elmStatement.parse(text)
}