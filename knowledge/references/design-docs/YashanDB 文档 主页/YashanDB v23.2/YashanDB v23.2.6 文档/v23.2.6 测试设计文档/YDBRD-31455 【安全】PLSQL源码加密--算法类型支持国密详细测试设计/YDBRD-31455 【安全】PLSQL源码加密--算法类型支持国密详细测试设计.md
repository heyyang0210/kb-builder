Created by 范瑜, last modified on 十月 14, 2024

# 1. 概述

SR:       [https://pingcode.yasdb.com/pjm/items/66bad12766228b94707e3333](https://pingcode.yasdb.com/pjm/items/66bad12766228b94707e3333)    ?    
  #YDBRD-31455 【安全】PLSQL源码加密–算法类型支持国密

开发设计链接：    [【安全】PLSQL源码加密--算法类型支持国密 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163005785)  

使用场景：

需求来源：  产品化需求

需求描述：

交付形态：  单机、分布式和集群'

# 2. 需求分析

## 2.1 功能点分析

 新增客户端参数  WRAP_ALOGRITHM 默认sha1，可选 sha1，sm3，指定plsql加密方式

涉及pl/sql包装工具yaswrap， 工具命令如下：

```
 yaswrap <span class="token assign-left variable" style="color: rgb(126,198,153);">iname</span><span class="token operator" style="color: rgb(103,205,204);">=</span>input_file <span class="token punctuation" style="color: rgb(204,204,204);">[</span>oname<span class="token operator" style="color: rgb(103,205,204);">=</span>output_file<span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span>keep_comments<span class="token operator" style="color: rgb(103,205,204);">=</span><span class="token punctuation" style="color: rgb(204,204,204);">{</span>yes<span class="token operator" style="color: rgb(103,205,204);">|</span>no<span class="token punctuation" style="color: rgb(204,204,204);">}</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span>
```

|参数|含义|备注|
|---|---|---|
|iname|需要进行包装加密的PL文本文件，支持指定相对路径|  
|
|oname|输出的包装加密文件，支持指定相对路径。|  
|
|keep_comments|指定是否保留注释，缺省值为no,- yes：只去除PL文本内的注释，保留其他注释。
- no：去除PL文本内的注释和其他注释。
|  
|


## 2.2 应用场景

对pl/sql的源码进行加密

## 2.3 规格约束

（1）  只包装包或类型的主体，而不包装规范（头部），不支持包装触发器的pl/sql源文本， 支持的  pl/sql 类型如下：

- Package specification
- Package body
- Type specification
- Type body
- Function
- Procedure


（2）  增加sha1、sm3的完整性校验

（3）兼容性：

加密：

|  
|  
|
|:---|:---|
|老版本|sha1 ok|
|新版本|sha1 ok、sm3 ok|
|信创版本|sha1 nok、sm3 ok|


解密：

|  
|老文件|新文件|
|:---|:---|:---|
|老实例|sha1 ok|sha1 ok，sm3 nok|
|新实例|sha1 ok|sha1 ok，sm3 ok|
|信创实例  需要测试|sha1 nok,![](https://pingcode.yasdb.com/atlas/files/public/67396df08970c2af4f5215fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFRQUFBQVFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQ0FBQ0FBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUNDQUFBZ0FBUUFBQUFBQUFBQ0FBQUFJZ0FBQUFBQUlBQUFCQUFCQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwMTAsImV4cCI6MTc4MjMyMzgxMH0.raHiIoX_8NKqQeeTw39SDCS1ik1_k0eBJJ3jyjFo1rI)|sha1 nok， sm3 ok,![](https://pingcode.yasdb.com/atlas/files/public/67396df08970c2af4f5215fb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFRQUFBQVFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQ0FBQ0FBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUNDQUFBZ0FBUUFBQUFBQUFBQ0FBQUFJZ0FBQUFBQUlBQUFCQUFCQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwMTAsImV4cCI6MTc4MjMyMzgxMH0.raHiIoX_8NKqQeeTw39SDCS1ik1_k0eBJJ3jyjFo1rI)|


# 3. 详细测试设计

## 3.1 测试设计方法

（1）功能测试：只是新增  sm3加密方式，对yaswrap工具原有功能无影响，此次不会过多关注yaswrap的原有功能，重点在sm3算法测试，使用场景法进行验证

（2）兼容性测试：涉及加密工具的兼容性、数据库多个版本之间对算法的兼容性

（3）客户端配置参数使用边界值等价类方法进行测试 

（4）性能测试：解密过程较短暂，不会对pl/sql程序性能造成很大影响， 所以此次只会简单对比pl/sql源程序和加密后的程序执行时间

执行时解密

### 3.1.1 功能测试

以下测试点无特殊说明， 都是基于  sm3加密方式

|测试项|测试子项|观察点|备注|
|---|---|---|---|
|PL/SQL类型|- Package specification
- Package body
- Type specification
- Type body
- Function
- Procedure
|1、执行加密后文件,2、查看  *_SOURCE视图， specification部分不会加密，body部分会进行加密,3、执行PL/SQL程序|怎么判断真的使用sm3算法？,（sha1/sm3）hash--base64--加密密文|
|PL/SQL程序内容|1、包或类型的主体带有注释， ,（1）注释类型：--   /*  */,（2）注释位置：主体头部、主体中、主体外,（3）注释内容 ：中英文、特殊字符等,（4）注释长度,2、PL/SQL程序内容包含中文、英文等,3、  PL/SQL除注释外程序长度：1M内，大于1M等|1、执行加密后文件,2、查看  *_SOURCE视图：,（1）主体头部、主体中的注释被删除，保留主体外的注释,3、执行PL/SQL程序|注释部分以前已测试，此次忽略|
|PL/SQL文件内容|1、多个可包装的PL/SQL程序,（1）都未加密,（2）部分加密（加密算法不一致）， 部分未加密,（3）全部都加密,2、包含除了PL/SQL外，其它SQL语句,3、PL/SQL文件加密后的长度|1、执行加密后文件,2、查看  *_SOURCE视图：,3、执行PL/SQL程序|一个文件：,plsq1 加密 算法不一致,plsql2 未加密,  
,yaswrap 加密 报错,  
,最后改成不会重复加密|
|PL/SQL程序执行|1、加密的PL/SQL程序调用未加密PL/SQL程序,2、加密的PL/SQL程序调用加密PL/SQL程序,（1）算法一致,（2）算法不一致,3、未加密的PL/SQL程序调用加密PL/SQL程序|执行PL/SQL程序成功|  
|
|PL/SQL加密文件执行|1、yasql 执行方式：,（1）-f -e,（2）-c,（3）@,2、exp/imp：,（1） exp导出后，imp导入,（2） exp --sql导出后， yasql导入,3、备份恢复,4、动态执行|1、执行加密文件的过程中不会暴露源码,（1）控制台打屏信息,（2）审计日志内容等,2、执行加密文件成功后，   *_SOURCE视图除了specification部分，显示的是加密后的内容,3、导出的文件内容不会暴露源码，导入后， *_SOURCE视图除了specification部分，显示的是加密后的内容，执行PL/SQL程序,4、备份恢复后， *_SOURCE视图除了specification部分，显示的是加密后的内容，执行PL/SQL程序,  
|备份恢复后也是密文,![](https://pingcode.yasdb.com/atlas/files/public/67396df0a1ad9a3311dc946e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFRQUFBQVFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQ0FBQ0FBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUNDQUFBZ0FBUUFBQUFBQUFBQ0FBQUFJZ0FBQUFBQUlBQUFCQUFCQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwMTAsImV4cCI6MTc4MjMyMzgxMH0.raHiIoX_8NKqQeeTw39SDCS1ik1_k0eBJJ3jyjFo1rI)|
|PL/SQL加密文件|有选择性修改加密后的文件内容， 如：,（1）增加/删除关键字（wraped）,（2）修改类型,（3）修改原始长度：长变短， 短变长,（4）修改加密后长度：长变短， 短变长,等其它内容|执行加密文件报错,修改后校验不出来，会执行成功|  
|
|字符集|1、加密文件与客户端字符集不一致， 执行加密文件， 执行程序,2、加密文件与服务端字符集不一致， 执行加密文件， 执行程序|1、  可能会报错,2、执行加密文件和执行程序成功|  
|


### 3.1.2 配置参数测试

|配置参数|有效类|备注|无效类|备注|
|---|---|---|---|---|
|WRAP_ALOGRITHM 默认sha1，可选 sha1，sm3|1、默认,2、sha1、sm3,3、大小写、带单双引号等|yaswrap执行成功，加密程序执行成功|1、空串、空格、其它字符串等|yaswrap执行报错，加密程序执行失败|


### 3.1.3 兼容性测试

|测试场景|预期|
|---|---|
|旧版本yaswrap生成的加密文件，在新版本db上执行加密文件，执行程序|1、执行加密后文件成功,2、查看  *_SOURCE视图， specification部分不会加密，body部分会进行加密,3、执行PL/SQL程序成功|
|新版本yaswrap使用  sha1、sm3  生成的加密文件， 在旧版本db上执行加密文件，执行程序|可能会失败,执行失败，因为有字符集功能,![](https://pingcode.yasdb.com/atlas/files/public/67396df08970c2af4f5215fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFRQUFBQVFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQ0FBQ0FBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUNDQUFBZ0FBUUFBQUFBQUFBQ0FBQUFJZ0FBQUFBQUlBQUFCQUFCQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwMTAsImV4cCI6MTc4MjMyMzgxMH0.raHiIoX_8NKqQeeTw39SDCS1ik1_k0eBJJ3jyjFo1rI)|
|存在存量加密PL/SQL程序，升级到新版本， 执行存量加密PL/SQL程序， 增加新/旧算法加密的程序， 新算法加密的程序调用的旧算法加密的程序 |执行成功,  
|


  


### 3.1.4 性能测试

|测试场景|预期|实际|
|---|---|---|
|对比  pl/sql源程序和加密后的程序执行时间|执行时间相差小于5%|![](https://pingcode.yasdb.com/atlas/files/public/67396df0a1ad9a3311dc946f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFRQUFBQVFnQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQ0FBQ0FBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBUUNDQUFBZ0FBUUFBQUFBQUFBQ0FBQUFJZ0FBQUFBQUlBQUFCQUFCQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMwMTAsImV4cCI6MTc4MjMyMzgxMH0.raHiIoX_8NKqQeeTw39SDCS1ik1_k0eBJJ3jyjFo1rI)|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|是|同上一章节|
|HA|  
|  
|
|压力|  
|  
|
|性能|是|同上一章节|
|可维护性|  
|  
|


  


# 4. 测试用例

[YDBRD-31455 【安全】PLSQL源码加密--算法类型支持国密文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjA4OTcwYzJhZjRmNTIxNWY2IiwicmVmX2lkIjoiNjczOTZkZWY1OTNmOTljOWZmMjM4MTAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDEwLCJleHAiOjE3ODIzOTk0MTB9.PNDMRsAdW8Geehdn03oT4DPP2yM_vsawMnxNkqLalQk)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[YDBRD-31455 【安全】PLSQL源码加密--算法类型支持国密文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjA4OTcwYzJhZjRmNTIxNWY2IiwicmVmX2lkIjoiNjczOTZkZWY1OTNmOTljOWZmMjM4MTAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDEwLCJleHAiOjE3ODIzOTk0MTB9.PNDMRsAdW8Geehdn03oT4DPP2yM_vsawMnxNkqLalQk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-9-29_16-9-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjBhMWFkOWEzMzExZGM5NDZjIiwicmVmX2lkIjoiNjczOTZkZWY1OTNmOTljOWZmMjM4MTAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMDEwLCJleHAiOjE3ODIzOTk0MTB9.7CUtNgv7w1h6iNPS4su7E5sbkgoRHXBhU6_g8jORpkY)

 (image/png)    
