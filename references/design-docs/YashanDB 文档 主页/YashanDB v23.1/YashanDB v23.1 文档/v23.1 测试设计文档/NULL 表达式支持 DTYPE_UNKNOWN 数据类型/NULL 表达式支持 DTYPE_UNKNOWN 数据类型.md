Created by 刘晓旋, last modified by  韩晓盼 on 十月 16, 2024

# 1. 概述

本需求主要是修正 YashanDB 内部关于 UNKNOWN 类型的推导，以及适配 plan0 的类型推导，使其尽可能可用。

# 2. 需求分析

  [YDBRD-13782](https://jira.yasdb.com/browse/YDBRD-13782?src=confmacro)    -  NULL表达式的数据类型指定为DTYPE_UNKNOWN  完成

### 2.1 功能特性

参见开发设计     [UNKNOW类型推导 开发设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=119547536)  

（1）当前涉及到 DTYPE_UNKNOWN 类型的有两类，一类是 NULL 表达式，另一类是绑定参数表达式。

（2）对于绑定参数类型，目前有 Conclude 类型重推导阶段，可以由底向上推导，使得执行计划正确。但是存在问题是第一次产生的 plan0 计划大概率不可用，需要修正，使其可用。

（3）对于 NULL 表达式，需要给予正确类型。或者类型赋予 DTYPE_UNKNOWN 时候仍然可用。

（4）Verify 阶段加入类型反推，由兄弟节点或者父亲节点来确定整条 UNKNOWN 路径上的节点类型。大概示意图如下。

![](https://pingcode.yasdb.com/atlas/files/public/67396961a1ad9a3311dc7631/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY5ODUsImV4cCI6MTc4MjEzNzc4NX0.ChJ789pGTMTG6mi4rYb5auIGueTKchnC9npzpm8DcmE)

### 2.2 约束

NA

# 3. 详细测试设计

### 3.1 功能测试

本需求重点关注 NULL 表达式的场景，绑定参数表达式已在变量窥视中有覆盖测试。

功能测试设计如下：

[NULL表达式支持UNKNOWN类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjA4OTcwYzJhZjRmNTFmN2I3IiwicmVmX2lkIjoiNjczOTY5NjA1OTNmOTljOWZmMjM0ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTg1LCJleHAiOjE3ODIyMTMzODV9.79g0TLuIUe2cnv8YleemLmkPdtkjJlTLIJ-e1sPA3Qg)

### 3.2 并发测试

并发场景：采用功能用例作为并发用例。覆盖：insert/update/delete 间并发。

### 3.3 长稳测试

考虑将功能测试用例放到长稳执行

### 3.4 性能测试

大并发的场景

## Attachments:

[NULL表达式支持UNKNOWN类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjA4OTcwYzJhZjRmNTFmN2I3IiwicmVmX2lkIjoiNjczOTY5NjA1OTNmOTljOWZmMjM0ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTg1LCJleHAiOjE3ODIyMTMzODV9.79g0TLuIUe2cnv8YleemLmkPdtkjJlTLIJ-e1sPA3Qg)

 (application/x-xmind)    


[image2023-7-4_20-2-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjBhMWFkOWEzMzExZGM3NjMwIiwicmVmX2lkIjoiNjczOTY5NjA1OTNmOTljOWZmMjM0ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTg1LCJleHAiOjE3ODIyMTMzODV9.rJU8Z_y0SlgDRHCdklE_Xxt5Os2yo2wewwrafc12NjM)

 (image/png)    


[image2023-7-4_20-2-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjA4OTcwYzJhZjRmNTFmN2I4IiwicmVmX2lkIjoiNjczOTY5NjA1OTNmOTljOWZmMjM0ZGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTg1LCJleHAiOjE3ODIyMTMzODV9.IMLfDt8dVudshrr4iGp8C9SRgJic6_MBZNy7ItahewE)

 (image/png)    
