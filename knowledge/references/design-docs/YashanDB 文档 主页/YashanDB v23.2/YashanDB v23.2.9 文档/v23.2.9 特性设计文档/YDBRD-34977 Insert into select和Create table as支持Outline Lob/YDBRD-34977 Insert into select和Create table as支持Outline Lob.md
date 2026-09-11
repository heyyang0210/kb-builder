Created by 胡威振, last modified on 十一月 11, 2024

IR链接：    [Insert into select和Create table as支持Outline Lob 23.2 IR](https://pingcode.yasdb.com/ship/ideas/66c836ea89f961f3300fca85?)  

SR链接：    [Insert into select和Create table as支持Outline Lob 23.2 SR](https://pingcode.yasdb.com/pjm/items/6729bd99e489dd086803df2d?)  

##   [1. 总述](#1-总述)  

本文档设计了分布式下Insert into select和Create table as支持Outline Lob。

需求范围支持分布式列表。

###   [1.1 需求来源](#11-需求来源)  

深智城

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|Insert into table1(col_lob) select col_lob from table2;|向table1中插入table2中的lob数据|是|
|SQL语法|Create table table1(col_lob) as select col_lob from table2|创建从table1并从table2中获取lob数据到table1中|是|


##   [3. 规格与约束](#3-规格与约束)  

1.Outline lob包括Outline clob 和 Outline blob，不包括Json类型。

2.分布式Insert into select 支持 Outline lob。

3.分布式Create table as 支持 Outline lob。

4.该特性不涉及函数规格的修改，即之前不支持Outline lob的函数，现在依然不支持。

5.master分支分布式支持heap表，该特性不修改分布式heap表相关规格，即heap表依然拦截报错这两种场景，需要关注测试场景。

6.br23.2分支分布式不支持heap表，不需要关注heap表测试场景。

##   [4. 详细设计](#4-详细设计)  

1.放开分布式对outline lob的拦截。拦截点有两处：

- 分布式读取lob的时候，如果insert into select中存在outline lob则拦截报错，该地方需要放开支持列执行引擎不报错。


```
static CodResult anlLobCheckUnsupported(AnlHandler* handler, const VarLob* varLob)
{
    .......
    // for insert into select outline
    AnlStmt* stmt = handler-&gt;currStmt;

    if (stmt-&gt;context != NULL &amp;&amp; stmt-&gt;context-&gt;type == SQL_INSERT &amp;&amp; stmt-&gt;context-&gt;planContext-&gt;actualExecEngine != ENGINE_COL) {
        AnlPlan* child = stmt-&gt;planContext-&gt;plan-&gt;dstbCoord.child;
        if (child != NULL &amp;&amp; child-&gt;insert.subQueryPlan != NULL) {
            COD_IMPL_ERROR("insert into table with outline lob in distribute database");
            return COD_ERROR;
        }
    }
    ......
}

```

- 执行batch insert时verify_utf8_boundary中放开对outline clob和outline blob的拦截。


2.执行batch insert时，在    `attach_to_data_set_with_explict`     和     `attach_to_data_set_with_rows`    中，对于outline lob，需要重新构造新的lob列。

- 通过    `columnarLobToVarLob`    将ColumnarLob转成存储可以插入的varLob。
- 增加新的接口    `ankInsertOutlineLob`    通过调用    `lobPrepareColLobInsert`    和    `lobInsertByType`    来插入outline lob到存储并且获取新的ColumnarLob以构造新的lob列。


3.attach data的时候直接使用新构造的lob列即可，不需要做其他修改。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1.单机Insert into select和Create table as + outline lob。

2.分布式Insert into select 和 Create table as + outline lob。

3.分布式Insert into select 和 Create table as + 聚合函数生成的outline lob。

4.分布式分区表和带有px分发场景。

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2024-4-27_20-7-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMWJhMWFkOWEzMzExZGM5NTIyIiwicmVmX2lkIjoiNjczOTZlMWI1OTNmOTljOWZmMjM4MjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTg2LCJleHAiOjE3ODI0MTA5ODZ9.Awnedc7JfP4JyVh5i7fqdSWiqIdUX3rsWGydAHgEQ6g)

 (image/png)    


[image2024-4-27_20-5-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMWJhMWFkOWEzMzExZGM5NTIzIiwicmVmX2lkIjoiNjczOTZlMWI1OTNmOTljOWZmMjM4MjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTg2LCJleHAiOjE3ODI0MTA5ODZ9.7ERsdv1MCWQoFq3sJIPG--DZYaucu6_BXW7hzj3s338)

 (image/png)    


[image2024-4-27_20-6-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMWI4OTcwYzJhZjRmNTIxNmFlIiwicmVmX2lkIjoiNjczOTZlMWI1OTNmOTljOWZmMjM4MjI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NTg2LCJleHAiOjE3ODI0MTA5ODZ9.-hjuVs11PV1mH3EEwTadn2imeNqfW8XwsdTJjYI4iU8)

 (image/png)    
