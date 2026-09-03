Created by 刘清萍, last modified by  许秋莹 on 十一月 09, 2023

## 1.概述

  本文主要内容为c驱动支持投影列cursor的测试设计。

## 2.需求分析

### 2.1需求来源

     SR链接：     [YDBRD-13072](https://jira.yasdb.com/browse/YDBRD-13072?src=confmacro)    -  【驱动】c驱动支持投影列cursor类型  完成

    开发设计文档：    [yacli支持投影列cursor类型](119550639.html)  

    相关资料：    [cursor相关](https://blog.csdn.net/qq_34745941/article/details/81294166)  

### 2.2 概述

C驱动支持cursor类型目前已经支持出参入参，此次需要支持cursor的fetch，即  **ResultSet结果集支持获取cursor类型数据**  。

**2.3功能简介**

支持cursor类型

如果fetch的类型是cursor，则只支持绑定YAC_SQLT_CURSOR类型，类型为YacHandle，对应stmt。在fetch以后，可以对YacHandle在进行fetch，拿到cursor对应的结果集信息。

YacHandle后续需要用户自己手动释放。目前只能绑定YacHandle，绑定其他的则会异常。

### 2.4示例

   YacChar  *     functionSql     =     (  YacChar  *  )

** **  **"create or replace function selectcursor(c1 in int) "**

** **  **"return sys_refcursor as "**

** **  **"c2 sys_refcursor; "**

** **  **"begin "**

** **  **" open c2 for "**

** **  **" select * from t2_cursor where col1 = c1; "**

** **  **" return c2; "**

** **  **"end;"**  **;**

  


** **  **YacHandle**  ** **  cursor1  ;

   YacChar  *     selectSql     =     "  **select selectcursor(1) from dual**  "  ;

   YAC_EXPECT_CALL  (  yacBindColumn  (  stmt  ,     0  ,     YAC_SQLT_CURSOR  ,     (  YacPointer  )  &  cursor1  ,     sizeof  (  YacHandle  ),     NULL  ));

   YacUint32     cursorRows     =     0  ;

//第一次fetch 拿到cursor句柄

   YAC_EXPECT_CALL  (  yacFetch  (  stmt  ,     &  cursorRows  ));

   YacInt32     value1  ;

   YacInt32     value2  ;

   YAC_EXPECT_CALL  (  yacBindColumn  (  cursor1  ,     0  ,     YAC_SQLT_INTEGER  ,     &  value1  ,     sizeof  (  YacInt32  ),     NULL  ));

   YAC_EXPECT_CALL  (  yacBindColumn  (  cursor1  ,     1  ,     YAC_SQLT_INTEGER  ,     &  value2  ,     sizeof  (  YacInt32  ),     NULL  ));

//第二次fetch 拿到句柄结果

   YAC_EXPECT_CALL  (  yacFetch  (  cursor1  ,     &  rows  ));

   ASSERT_EQ  (  value1  ,     1  );

   ASSERT_EQ  (  value2  ,     9999  );

## 3.测试设计方法

        主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|select  cursor1，cursor2|个数 1，3，5|  
|  
|  
|
|cursor嵌套|嵌套层数1，2，3|  
|  
|  
|
|fetch前|bindcol 用  YAC_SQLT_CURSOR绑定|  
|用其他类型绑定查看报错|  
|
|fetch后|getdata 用  YAC_SQLT_CURSOR绑定|  
|用其他类型get data查看报错|  
|
|出参|bindparameter--出参|  
|  
|  
|
|cursor中select 列数|1，2，5|  
|  
|  
|
|原有出入参用例（待补充|cursor变量,![](https://pingcode.yasdb.com/atlas/files/public/673969a48970c2af4f51f9ad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFCQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFDQUFFQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTUsImV4cCI6MTc4MjIxODgxNX0.mjYshNA-wz35AMs3v7SFwacP6Hsmfp5sht4V7MUBatQ)|  [yasdb_jdbc_test/src/test/java/row/cursorcallablestatement/getmultiplecursor · master · CoD-X / Yastest Driver · GitLab](https://git.yasdb.com/cod-x/yastest_driver/-/tree/master/yasdb_jdbc_test/src/test/java/row/cursorcallablestatement/getmultiplecursor)  |  
|  
|
|  
|显示游标,![](https://pingcode.yasdb.com/atlas/files/public/673969a4a1ad9a3311dc7824/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFCQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFDQUFFQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTUsImV4cCI6MTc4MjIxODgxNX0.mjYshNA-wz35AMs3v7SFwacP6Hsmfp5sht4V7MUBatQ)|  
|  
|  
|
|  
|sys_refcursor,![](https://pingcode.yasdb.com/atlas/files/public/673969a48970c2af4f51f9ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFCQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBUWdBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFDQUFFQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTUsImV4cCI6MTc4MjIxODgxNX0.mjYshNA-wz35AMs3v7SFwacP6Hsmfp5sht4V7MUBatQ)|  
|begin,proc1(?,?);,end;,  
,  
,call proc(?,?);,exec proc(?,?);|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|cursor类型来源|自定义函数|  
|  
|  
|
|cursor出现位置|投影列|  
|where条件后|  
|
|  
|  
|  
|groupby 后|  
|
|  
|  
|  
|order by后|  
|
|  
|  
|  
|having后|  
|


  


## 5.测试用例设计

|函数名称|测试点|是否符合预期|备注|
|---|---|---|---|
|void test_cursor_1(void)|select 单个cursor 单列|符合预期|  
|
|void test_cursor_2(void)|select 单个cursor 多列|符合预期|  
|
|void test_cursor_3(void)|select 多个cursor|符合预期|  
|
|void test_cursor_4(void)|cursor 嵌套|符合预期|  
|
|void test_cursor_5(void)|fetch前，使用yacBindColumn接口绑定|符合预期|  
|
|void test_cursor_6(void)|fetch后，使用  yacGetData获取数据|符合预期|  
|
|void test_cursor_7(void)|出参，  yacBindParameter接口|符合预期|  
|
|void test_cursor_8(void)|打印报错，where/order by/group by 条件后，打印报错|符合预期|  
|
|void test_cursor_9(void)|cursor 三层嵌套|符合预期|  
|
|void test_cursor_10(void)|出入参 cursor变量 2列|符合预期|  
|
|void test_cursor_11(void)|出入参 cursor变量 3列|符合预期|  
|
|void test_cursor_12(void)|sys_refcursor out|符合预期|  
|
|void test_cursor_13(void)|显示游标 打印报错|符合预期|  
|
|void test_cursor_14(void)|sys_refcursor inout|符合预期|  
|
|void test_cursor_15(void)|fetch前 bindcol 用其他类型绑定 打印报错|符合预期|  
|
|void test_cursor_16(void)|fetch后 getdata 用其他类型绑定 打印报错|符合预期|  
|


## 6.测试框架设计

 本次测试采用cunit测试框架实现，执行test_cursor.h文件，对比期望结果与输出结果，输出测试结果。

## 7.测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|  
|


  


  


## Attachments:

[image2023-4-11_15-33-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTRhMWFkOWEzMzExZGM3ODFmIiwicmVmX2lkIjoiNjczOTY5YTQ1OTNmOTljOWZmMjM1MGUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MDE1LCJleHAiOjE3ODIyOTQ0MTV9.88vqVrm5G4yFVv8fMoc1kQElhxqMRKy1-DqfH3Yfkek)

 (image/png)    
