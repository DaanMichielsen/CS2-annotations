// packages/shared/src/annotation/inferUtils.test.ts
import { describe, it, expect } from 'vitest'
import { inferThrowType } from './inferUtils'
import type { AnnotationNode } from './types'

function node(desc: string, title = ''): AnnotationNode {
  return { Desc: { Text: desc }, Title: { Text: title } } as unknown as AnnotationNode
}

describe('inferThrowType', () => {
  describe('m1m2_jump', () => {
    it('detects m1+m2', () => expect(inferThrowType(node('m1+m2'))).toBe('m1m2_jump'))
    it('detects m1m2', () => expect(inferThrowType(node('m1m2'))).toBe('m1m2_jump'))
    it('detects lmb+rmb', () => expect(inferThrowType(node('lmb+rmb'))).toBe('m1m2_jump'))
    it('detects both clicks', () => expect(inferThrowType(node('both clicks'))).toBe('m1m2_jump'))
    it('detects both mouse', () => expect(inferThrowType(node('both mouse'))).toBe('m1m2_jump'))
  })

  describe('m2_jump', () => {
    it('detects m2 jump', () => expect(inferThrowType(node('m2 jump'))).toBe('m2_jump'))
    it('detects m2jt',   () => expect(inferThrowType(node('m2jt'))).toBe('m2_jump'))
    it('detects m2 jt',  () => expect(inferThrowType(node('m2 jt'))).toBe('m2_jump'))
    it('detects rmb jump', () => expect(inferThrowType(node('rmb jump'))).toBe('m2_jump'))
    it('detects rmb jt',   () => expect(inferThrowType(node('rmb jt'))).toBe('m2_jump'))
    it('detects right click jump', () => expect(inferThrowType(node('right click jump'))).toBe('m2_jump'))
  })

  describe('m2', () => {
    it('detects m2',          () => expect(inferThrowType(node('standing m2 throw'))).toBe('m2'))
    it('detects rmb',         () => expect(inferThrowType(node('rmb throw'))).toBe('m2'))
    it('detects right click', () => expect(inferThrowType(node('right click'))).toBe('m2'))
    it('detects rclick',      () => expect(inferThrowType(node('rclick'))).toBe('m2'))
    it('detects right mouse', () => expect(inferThrowType(node('right mouse'))).toBe('m2'))
  })

  describe('w_jump', () => {
    it('detects w-jump',      () => expect(inferThrowType(node('w-jump'))).toBe('w_jump'))
    it('detects w+jump',      () => expect(inferThrowType(node('w+jump'))).toBe('w_jump'))
    it('detects w jump',      () => expect(inferThrowType(node('w jump'))).toBe('w_jump'))
    it('detects wjump',       () => expect(inferThrowType(node('wjump'))).toBe('w_jump'))
    it('detects w-jt',        () => expect(inferThrowType(node('w-jt'))).toBe('w_jump'))
    it('detects w jt',        () => expect(inferThrowType(node('w jt'))).toBe('w_jump'))
    it('detects wjt',         () => expect(inferThrowType(node('wjt'))).toBe('w_jump'))
    it('detects w+space',     () => expect(inferThrowType(node('w+space'))).toBe('w_jump'))
    it('detects w jumpthrow', () => expect(inferThrowType(node('w jumpthrow'))).toBe('w_jump'))
    it('detects W-Jumpthrow from title', () =>
      expect(inferThrowType(node('', 'standing W-Jumpthrow'))).toBe('w_jump'))
  })

  describe('crouch_jump', () => {
    it('detects crouched',    () => expect(inferThrowType(node('crouched jumpthrow'))).toBe('crouch_jump'))
    it('detects crouch jump', () => expect(inferThrowType(node('crouch jump'))).toBe('crouch_jump'))
    it('detects duck',        () => expect(inferThrowType(node('duck jump'))).toBe('crouch_jump'))
    it('detects cjt',         () => expect(inferThrowType(node('cjt'))).toBe('crouch_jump'))
  })

  describe('run_jump', () => {
    it('detects run jump',          () => expect(inferThrowType(node('run jump'))).toBe('run_jump'))
    it('detects run jt',            () => expect(inferThrowType(node('run jt'))).toBe('run_jump'))
    it('detects runjump',           () => expect(inferThrowType(node('runjump'))).toBe('run_jump'))
    it('detects rjt',               () => expect(inferThrowType(node('rjt'))).toBe('run_jump'))
    it('detects running jumpthrow', () => expect(inferThrowType(node('running jumpthrow'))).toBe('run_jump'))
    it('detects running jump',      () => expect(inferThrowType(node('running jump'))).toBe('run_jump'))
  })

  describe('stand_jump', () => {
    it('detects jumpthrow',    () => expect(inferThrowType(node('jumpthrow'))).toBe('stand_jump'))
    it('detects jthrow',       () => expect(inferThrowType(node('jthrow'))).toBe('stand_jump'))
    it('detects jt alone',     () => expect(inferThrowType(node('jt'))).toBe('stand_jump'))
    it('detects j-throw',      () => expect(inferThrowType(node('j-throw'))).toBe('stand_jump'))
    it('detects jump throw',   () => expect(inferThrowType(node('jump throw'))).toBe('stand_jump'))
    it('detects standing jump',() => expect(inferThrowType(node('standing jump'))).toBe('stand_jump'))
    it('detects stand jt',     () => expect(inferThrowType(node('stand jt'))).toBe('stand_jump'))
  })

  describe('run', () => {
    it('detects running throw', () => expect(inferThrowType(node('running throw'))).toBe('run'))
    it('detects runthrow',      () => expect(inferThrowType(node('runthrow'))).toBe('run'))
    it('detects run throw',     () => expect(inferThrowType(node('run throw'))).toBe('run'))
  })

  describe('walk', () => {
    it('detects walking throw', () => expect(inferThrowType(node('walking throw'))).toBe('walk'))
    it('detects walkthrow',     () => expect(inferThrowType(node('walkthrow'))).toBe('walk'))
    it('detects walk throw',    () => expect(inferThrowType(node('walk throw'))).toBe('walk'))
  })

  describe('stand', () => {
    it('detects standing',() => expect(inferThrowType(node('standing throw'))).toBe('stand'))
    it('detects static',  () => expect(inferThrowType(node('static'))).toBe('stand'))
    it('detects regular', () => expect(inferThrowType(node('regular throw'))).toBe('stand'))
    it('detects normal',  () => expect(inferThrowType(node('normal'))).toBe('stand'))
    it('detects lmb',     () => expect(inferThrowType(node('lmb throw'))).toBe('stand'))
    it('detects left click', () => expect(inferThrowType(node('left click'))).toBe('stand'))
  })

  describe('other', () => {
    it('returns other for unrecognized text', () => expect(inferThrowType(node('from banana'))).toBe('other'))
    it('returns other for empty node',        () => expect(inferThrowType(node(''))).toBe('other'))
  })

  describe('priority ordering', () => {
    it('m1m2 beats m2',        () => expect(inferThrowType(node('m1+m2 jumpthrow'))).toBe('m1m2_jump'))
    it('m2_jump beats m2',     () => expect(inferThrowType(node('standing m2 jumpthrow'))).toBe('m2_jump'))
    it('run_jump beats run',   () => expect(inferThrowType(node('running jumpthrow'))).toBe('run_jump'))
    it('run_jump beats stand_jump', () => expect(inferThrowType(node('run jump'))).toBe('run_jump'))
    it('w_jump: "w jt" does not bleed into stand_jump', () =>
      expect(inferThrowType(node('w jt'))).toBe('w_jump'))
    it('m2_jump: "m2 jt" does not bleed into stand_jump', () =>
      expect(inferThrowType(node('m2 jt'))).toBe('m2_jump'))
    it('crouch_jump: "crouch jt" does not bleed into stand_jump', () =>
      expect(inferThrowType(node('crouch jt'))).toBe('crouch_jump'))
    it('w_jump: "throw jump" must not bleed into w_jump', () =>
      expect(inferThrowType(node('throw jump'))).toBe('stand_jump'))
    it('stand_jump: bare "jump" is a stand_jump', () =>
      expect(inferThrowType(node('jump'))).toBe('stand_jump'))
    it('stand_jump: "normal jump" is stand_jump not stand', () =>
      expect(inferThrowType(node('normal jump'))).toBe('stand_jump'))
  })
})
