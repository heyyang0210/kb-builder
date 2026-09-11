Created by 刘晓旋, last modified on 十月 09, 2024

# 1. 概述

本文描述单机支持 FETCH FIRST n ROWS ONLY 的测试设计。

本需求支持 FTETCH FIRST n ROWS ONLY 的功能，实现 OFFSET offset ROWS FETCH FIRST rowcount ROWS ONLY;  取出 n 行数据，和 LIMIT OFFSET 实现的功能相同。

  


# 2. 需求分析

  [YDBRD-15620](https://jira.yasdb.com/browse/YDBRD-15620?src=confmacro)    -  支持FETCH FIRST n ROWS ONLY功能  开发中

### 2.1 功能特性

参见开发设计     [FETCH FIRST n ROWS ONLY设计开发文档](https://conf.yasdb.com/pages/viewpage.action?pageId=117670499)  

### 2.2 开发接口

**1、语法**

Oracle 语法

![](https://pingcode.yasdb.com/atlas/files/public/67396bde8970c2af4f520784/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUVBQUFJQUFBZ0FBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc1MTUsImV4cCI6MTc4MjMwODMxNX0.G0UfJXnfKqQWLcyIeVV6hZW5q1lyz6pYu0H2rOICLGg)

  


DB2 语法

![](https://pingcode.yasdb.com/atlas/files/public/67396bde8970c2af4f520785/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUVBQUFJQUFBZ0FBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc1MTUsImV4cCI6MTc4MjMwODMxNX0.G0UfJXnfKqQWLcyIeVV6hZW5q1lyz6pYu0H2rOICLGg)

  


1. ROW 和 ROWS 语法含义相同，Oracle 官方文档解释为 row 和 rows 可以互相替换使用，为提供清晰的语义而设定两个关键字。

2. FIRST 和 NEXT 语法含义相同

3. ONLY:  返回 OFFSET+1 位置起的 rowcount 行数据

4. WITH TIES: 有 ORDER BY 关键字时起作用，除了返回 fetch 对应数据，还会返回 order by 列和最后一行相同的结果集，实际返回数量大于 rowcount，没有 order by 时和 only 语法含义相同

5. PERCENT: 返回 rowcount 乘以 percent 数量的数据

现状：现阶段我们与 DB2 语法保持一致，这个需求暂不支持 PERCENT 和 WITH TIES。

  


**2、参数**

|参数|说明|
|:---|:---|
|offset|为 NULL 或者大于实际行数时都返回 0 行； 为负数时都按 0 处理； 为小数时都直接向下取整|
|rowcount|为 NULL 时返回 0 行，大于实际最大行数时返回所有行，负数时都按 0 处理； 为小数时都直接向下取整|
|percent|根据返回总数进行相乘，有小数时直接进行向上取整，大于 100 返回所有，小于等于 0 或为 NULL 返回 0 行|


### 2.3 约束

1. PERCENT:  语法上不支持。
1. WITH TIES: 语法上不支持。
1. offset: 为 NULL 或者大于实际行数时都  **返回 0 行**  ； 为负数时都按 0 处理；  ~~**yashan 为 NULL 的处理跟 Oracle不一致； **~~  offset 类型为 BINGINT，取值范围为   -2  63    ~ 2  63  -1。
1. rowcount: 为 NULL时 返回 0 行，大于实际最大行数时返回所有行，负数时都按 0 处理；  **可以省略，默认取1；**  ** **  rowcount 类型为 BIGINT，取值范围为   -2  63    ~ 2  63  -1。
1. 如果只有 OFFSET offset ROW/ROWS;  省略后面的 FETCH 语法，rowcount 按照 BINGINT 最大值 2  63  -1 处理，返回 offset+1 后面的所有行。


  


# 3. 详细测试设计

### 3.1 功能测试

功能用例将采用等价类、边界值、场景法等设计方法。

功能测试设计如下：

[单机支持 FETCH FIRST n ROWS ONLY 测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGVhMWFkOWEzMzExZGM4NWY2IiwicmVmX2lkIjoiNjczOTZiZGU1OTNmOTljOWZmMjM2N2JhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTE1LCJleHAiOjE3ODIzODM5MTV9.t7LxSpH2tWrCb0RgcAtBKgKt-4IBP-qYomwvciCuNHE)

冒烟用例：

[offset fetch 冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGU4OTcwYzJhZjRmNTIwNzgyIiwicmVmX2lkIjoiNjczOTZiZGU1OTNmOTljOWZmMjM2N2JhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTE1LCJleHAiOjE3ODIzODM5MTV9.opVkptfqYmzvPyNhyKSNmEhl17oz1s-x5pBMzJgekC4)

  


### 3.2 并发测试

并发场景：采用功能用例作为并发用例

### 3.3 长稳测试

考虑将功能测试用例放到长稳执行

### 3.4 性能测试

与 limit offset 的性能做对比

## Attachments:

[单机支持 FETCH FIRST n ROWS ONLY 测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGVhMWFkOWEzMzExZGM4NWY2IiwicmVmX2lkIjoiNjczOTZiZGU1OTNmOTljOWZmMjM2N2JhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTE1LCJleHAiOjE3ODIzODM5MTV9.t7LxSpH2tWrCb0RgcAtBKgKt-4IBP-qYomwvciCuNHE)

 (application/x-xmind)    


[offset fetch 冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGU4OTcwYzJhZjRmNTIwNzgyIiwicmVmX2lkIjoiNjczOTZiZGU1OTNmOTljOWZmMjM2N2JhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTE1LCJleHAiOjE3ODIzODM5MTV9.opVkptfqYmzvPyNhyKSNmEhl17oz1s-x5pBMzJgekC4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
