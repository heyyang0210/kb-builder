Created by 李凯峰, last modified on 五月 13, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

*SR:*    [https://pingcode.yasdb.com/pjm/items/6618edb3fd997db58ad84110](https://pingcode.yasdb.com/pjm/items/6618edb3fd997db58ad84110)    *?*    
  *#YDBRD-26184 支持PERCENTILE_CONT函数*

*开发设计文档：*    [ Percentile_Cont - YashanDB - SICS-CoD Confluence (yasdb.com) ](https://conf.yasdb.com/display/YAS/Percentile_Cont)  

# 2. 需求分析

## 2.1 功能点分析

- 一组数据根据排序键进行排序以后，数据按照线性排列，入参为0-1的数值，得到一个百分比的数字，如0.5得到的是50%这个位置的中位数
- 支持窗口函数和聚合函数两种使用方式


## 2.2 应用场景

- 应用在查找某个百分位排序后的确切的值的场景中，如中位数


## 2.3 规格约束

- 入参个数1个
- 入参为0-1，可以为小数
- 对齐oracle


# 3. 详细测试设计

## 3.1 测试设计方法

  


1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[行存支持PERCENTILE_CONT函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWI4OTcwYzJhZjRmNTIwZjE3IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.vMnR0tXRzs9kD42rx7-HgBhuiMRL5xdEqH-w5yK0egc)

*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


  


# 4. 测试用例

1.冒烟用例：

# 5. 测试框架设计

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：12  *人天*

计划测试完成时间：2024/6/5

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWI4OTcwYzJhZjRmNTIwZjE4IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.KjPz8YjDzz3D99zSX7-MQeLit2O-zM4zJdW4GeKHIDo)

## Attachments:

[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWI4OTcwYzJhZjRmNTIwZjE5IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.WgMyvsHMP20NZwEdatq3cg_UN7WW_tMantDxzjUo3zE)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWJhMWFkOWEzMzExZGM4ZDg4IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.c8AaZAySU4YObo9mu-uAsEarzjE9S1NS2_o3mJFm7EM)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWJhMWFkOWEzMzExZGM4ZDg5IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.n0GpSwmYawcfA1Z5lfkQQ5kXo-h6n4_vXP-SxZSagmY)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWI4OTcwYzJhZjRmNTIwZjFhIiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.-6S230koxJl6BBokbPWK48THpLrTwx-ov0S-jliCc1k)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWI4OTcwYzJhZjRmNTIwZjE4IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.KjPz8YjDzz3D99zSX7-MQeLit2O-zM4zJdW4GeKHIDo)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWJhMWFkOWEzMzExZGM4ZDhiIiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.7Oyc5HG1uzX70OxkDloBmvPOCL6xB_vJyzW19MFa2bc)

 (application/msword)    


[行存支持PERCENTILE_CONT函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWI4OTcwYzJhZjRmNTIwZjE3IiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjgwLCJleHAiOjE3ODIzOTEwODB9.vMnR0tXRzs9kD42rx7-HgBhuiMRL5xdEqH-w5yK0egc)

 (application/x-xmind)    
