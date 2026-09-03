Created by 贺天欢, last modified on 一月 03, 2024

IR链接：    [YDBRD-22915](https://jira.yasdb.com/browse/YDBRD-22915?src=confmacro)    -  超32000长度的CLOB支持like过滤  验收中

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*部署形态：*  *单机*

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1）LIKE原有基本语法为：

![](https://pingcode.yasdb.com/atlas/files/public/67396b738970c2af4f5204a9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQzNzQsImV4cCI6MTc4MjMwNTE3NH0.tCDRplKmyje4ylE80fcQuo5ndjDjyGiwh_XI7pcR1wE)

char1是一个字符表达式，例如一个字符列，叫做搜索值。

char2是一个字符表达式，通常是一个字面量，叫做模型。

esc_char是一个字符表达式，通常是一个字面量，叫做  转义字符  。

1）如果不指定esc_char,则没有默认转义字符。如果char1,char2或esc_char任何一个为空，则结果是未知的。如果搜索值即char1中包含_或%，则需要使用escape子句

2）所有的表达式可以是数据类型中的任何一种。如果他们的数据类型不一样，  都将转为VARCHAR类型进行判断  。

3）模型可以包含特殊字符匹配模式：

下划线（_）：严格匹配一个字符。

百分号（%）：可以匹配零个或多个字符  。

2）新增功能：char1支持超32000B长度

**CLOB支持like过滤情况：**

|形态|小于等于32000字节的clob like|大于32000字节的clob like|
|:---|:---|:---|
|单机行执行|支持|**支持(这个SR后支持)**|
|单机列执行|支持|不支持|


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*1、当前超过32000B的数据类型有clob\nclob\blob\json\xmltype   --*  *只支持clob，测试其他类型超过32000B时和原有表现一致*

*2、最大能支持clob的max  --*  *测试覆盖下4G的clob*

*3、绑定参数   --*  *测试验证plsql\jdbc都支持*

*4、like左右两边是否都支持超32000B长度（仅左边）   --*  *因为pattern expr在内部处理会隐式转换成字符型，长度不能超过32000字节 ，覆盖测试比如两个表的超长列和列做 like*

*5、服务端字符集不是GBK字符集、当前like不带escape表达式、pattern表达式不超过255B，同时满足这3者时走kmp算法like匹配，其他时都走通用like匹配逻辑    --*  *测试覆盖服务端是UTF8、GBK的clob超32000B下like过滤*

*6、*  *23.2版本*  *支持Gb18030后，服务端字符集是gb18030时like匹配逻辑情况同GBK字符集    --*  *测试验证服务端字符集gb18030时的clob超32000B下like过滤期望同GBK*

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景：*

*长度规格主要覆盖：*  ***32000B、32001B、65536B（64K）、65537B、2097152B（2M）、2097153B、33554432B（32M）***

*超过32000B长度时的like/not like数据类型覆盖、like/not like通配符使用、like/not like应用位置*

*需求与其他特性的关联场景：*

*DDL、DML、PLSQL中涉及超过32000B长度时的like/not like条件过滤*

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

测试设计方法用到了：等价类划分，错误推测，边界值分析，条件组合和场景分析

部署形态：单机，集群天然支持

表类型：行列都支持

测试维度如下：

**维度一：clob的长度（测试重点保障）**

可分为0 ~ 32K（不在本SR范围，不过也可以取下，确认不影响原有处理），32000B、32001B、64000B、64001B、2MB、32MB、>32MB，各范围取值，同时也注意考虑边界值

**维度二：pattern的长度**

可分为1 ~ 255字节，255字节 ~ 32000字节，32000字节以上（报错），各范围取值，同时也注意考虑边界值

**维度三：pattern的内容**

可分为 不含通配符、含 百分号 通配符（百分号表示匹配任意个字符）、含 下划线 分配符（下划线表示匹配一个字符）、以及混合情况（通配符可在任意位置，包括但不限于首部、尾部）

**维度四：like是否带有escape表达式**

**维度五：当前系统字符集**

在UTF8和GBK的字符集下都执行一遍用例

**维度六：expr的形式**

包括但不限于列、常量、绑定参数、  case表达式  。 --  函数  表达式不适用，因为出为字符的所有函数都<=32000B

**以上维度可以混合测试。**

详细见下：

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略：GUIDER可满足自动化覆盖*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*后面回合23.2版本时候，覆盖测试服务端是gb18030字符集的情况*

## Attachments:

[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzNhMWFkOWEzMzExZGM4MzFiIiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.2Bv9dtpDZn42tLOodnDj3eQMVG_Am9QY1tyYuYyUh2Y)

 (application/x-xmind)    


[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzM4OTcwYzJhZjRmNTIwNGE3IiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.mk_bhTRkkDa3HC4xsEGdTyxhDqstttq_gekqRwXQpUc)

 (application/x-xmind)    


[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzNhMWFkOWEzMzExZGM4MzFjIiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.oX_xxsluLIaWnU2uCcD8XBZlhNwZ9oNJEHzPXs_obT4)

 (application/x-xmind)    


[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzM4OTcwYzJhZjRmNTIwNGE4IiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.IloP40UzaFYLTDeONq3TzdYBVFklWQgfXLDR0wkDjVE)

 (application/x-xmind)    


[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzNhMWFkOWEzMzExZGM4MzFkIiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.yei9BKI9IlcIGE32jA4sbzWLv_VGpYewIJdAomYxa60)

 (application/x-xmind)    


[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzNhMWFkOWEzMzExZGM4MzFlIiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.19KBJNPh7er8l40TIga3J42DlMUKP1LZjmYe-nvIJgc)

 (application/x-xmind)    


[超32000长度CLOB支持like概设.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzNhMWFkOWEzMzExZGM4MzFmIiwicmVmX2lkIjoiNjczOTZiNzI3MjgyMDZlZmI5MmYwNjBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0Mzc0LCJleHAiOjE3ODIzODA3NzR9.Fl7uOuRi4EIRFqMxmvG24w7GCyldvTxbVmVOlfE9LcA)

 (application/x-xmind)    
