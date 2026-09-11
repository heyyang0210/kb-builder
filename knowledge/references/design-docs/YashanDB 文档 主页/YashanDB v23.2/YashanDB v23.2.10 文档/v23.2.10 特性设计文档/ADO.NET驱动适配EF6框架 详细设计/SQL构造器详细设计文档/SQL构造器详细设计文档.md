Created by 张周玺, last modified on 八月 09, 2024

## 1. 整体设计

SQL构造器的职责是根据上层输入的DbCommandTree，拼成对应的sql语句，并且整理好需要绑定的参数。

由于DbCommandTree里面包含了各种类型的  DbExpression，为了实现了对各种类型的DbExpression的灵活处理，EF框架设计了  **访问者模式**  来把每个sql表达式的解析与表达式本身做了分离。

整体的类图设计如下：

![](https://pingcode.yasdb.com/atlas/files/public/67395f678970c2af4f51cde6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ1FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUxMTYsImV4cCI6MTc4MjM1NTkxNn0.bJ2IBlXKP3XvRv1_cjXBqSoZLsFtUIX5RcqaCbQmakw)

上图中蓝色为框架提供的，绿色为我们自己实现的。

框架提供了：

1. 被访问的元素接口  DbExpression以及它的四十多种实现。
1. 对象结构DbCommandTree
1. 访问者接口  DbExpressionVisitor。


需要我们开发的是：

1. 实现DbExpressionVisitor接口中的所有visit接口  。
1. 定义visit方法的返回值类型。
1. 调用visit实现sql拼装和参数整理。


## 2、详细设计

### 1、SQL生成器

SqlGenerator实现了DbExpressionVisitor接口，主要方法/属性如下：

|  
|说明|
|---|---|
|string   GenerateSQL  (  DbCommandTree commandTree  )|把框架传来的DbCommandTree 翻译成sql语句。留给子类去实现|
|List  <  YasdbParameter  >   Parameters   {   get  ;   private   set  ; }|拼sql过程中生成的参数都放到Parameters 这个list中|
|SqlFragment visit(  DbExpression  ),...等四十多种不同  DbExpression子类型的访问方法|访问  DbExpression，根据不同的DbExpression返回不同的sql片段对象|


SqlGenerator的作用是把DbCommandTree解析翻译成sql语句，由于DbCommandTree有如下5中类型，所以我们需要给SqlGenerator定义五种子类型，分别去处理增删改查和函数的sql语句。

不同的DbCommandTree与SqlGenerator的对应关系。

|输入的DbCommandTree类型|对应的SqlGenerator|  
|
|---|---|---|
|DbQueryCommandTree|SelectGenerator|  
|
|DbInsertCommandTree|InsertGenerator|  
|
|DbUpdateCommandTree|UpdateGenerator|  
|
|DbDeleteCommandTree|DeleteGenerator|  
|
|DbFunctionCommandTree|FunctionGenerator|  
|


这五种Generator都必须要实现string GenerateSQL(DbCommandTree commandTree)接口，在GenerateSQL接口中去调visit方法拼出来sql语句，并把参数整理出来放到Parameters 中。并且根据需要去重写个别visit方法。

### 2、SqlFragment 片段

SqlFragment是我们自定义的visit方法的返回值，专门用来生成sql片段字符串的，里面最核心的方法如下：

|  
|  
|
|---|---|
|void   WriteSql  (  StringBuilder sql  )；|把sql片段写到StringBuilder里|
|string   ToString  ()|获取sql片段字符串|


根据类型不同，定义了如下SqlFragment类型

  


|类型|父类|含义|
|---|---|---|
|BinaryFragment|NegatableFragment|由左右两边和一个中间操作符组成的sql片段，比如过滤条件里的id=1，（条件1） and （条件2）|
|InFragment|NegatableFragment|in sql片段，in,not in|
|CaseFragment|SqlFragment|case when then片段|
|ColumnFragment|SqlFragment|投影列，列名，表名，别名|
|ExistsFragment|NegatableFragment|Exists，not Exists|
|FunctionFragment|SqlFragment|函数片段，函数名，参数，是否加引号，是否带DISTINCT关键词（一般是配合count聚合函数使用）|
|IsNullFragment|NegatableFragment|IS null,is not null|
|LikeFragment|NegatableFragment|like, not like|
|ListFragment|SqlFragment|多个SqlFragment组成的sql片段列表|
|NegatableFragment|SqlFragment|可否定的sql片段，表示过滤条件的sql片段|
|LiteralFragment|SqlFragment|字面量|
|PropertyFragment|SqlFragment|列的一些属性信息|
|SortFragment|SqlFragment|排序，列名，正反序 ASC，DESC|
|InputFragment|SqlFragment|from片段|
|UnionFragment|InputFragment|Union语句，UNION DISTINCT，UNION ALL|
|JoinFragment|InputFragment|join查询|
|TableFragment|InputFragment|表名|
|SelectStatement|InputFragment| 查询语句|


### 3、  DbExpression类型列表和visit方法的主要实现细节

|DbExpression的子类型|大概含义|visit方法返回的SqlFragment类型|
|---|---|---|
|DbVariableReferenceExpression|变量引用|PropertyFragment|
|DbPropertyExpression|列的一些属性|PropertyFragment|
|DbScanExpression|要查询的表|TableFragment|
|DbParameterReferenceExpression|参数表达式|LiteralFragment 转化成,"@"   +   expression  .  ParameterName 的字面量|
|DbNotExpression|not表达式|NegatableFragment|
|DbIsEmptyExpression|是否存在|ExistsFragment|
|DbFunctionExpression|函数|内置函数转化成 LiteralFragment：内容为拼好function这一块的字面量。    
    
  用户自定义函数会按照函数名参数等拼成,FunctionFragment,  
|
|DbConstantExpression|sql语句里面的常量value值|LiteralFragment,数字和布尔类型转化成数字字面量,其他类型直接当成参数进行绑定，一般就是字面量问号|
|DbComparisonExpression|比较|如果是like操作，返回LikeFragment，,其他操作，返回 BinaryFragment|
|DbAndExpression|and|BinaryFragment|
|DbOrExpression|or|BinaryFragment|
|DbCastExpression|cast|  
|
|DbInExpression|in|InFragment|
|DbLambdaExpression|  
|没实现|
|DbLikeExpression|like|LikeFragment|
|DbCaseExpression|case when|CaseFragment|
|DbIsNullExpression|is null|IsNullFragment|
|DbIntersectExpression|交集操作|不支持|
|DbNullExpression|null|LiteralFragment  (  "NULL"  )|
|DbArithmeticExpression|算术表达式|如果为负，返回 ListFragment，拼上-号和括号,  
,其他的都会转成BinaryFragment |
|DbTreatExpression|多态表达式|不支持|
|DbRelationshipNavigationExpression|关系导航|不支持|
|DbRefExpression|Ref|不支持|
|DbOfTypeExpression|OfType|不支持|
|DbIsOfExpression|IsOf|不支持|
|DbRefKeyExpression|RefKey|不支持|
|DbEntityRefExpression|EntityRef|不支持|
|DbExceptExpression|Except|不支持|
|DbDerefExpression|表示基于指定引用检索实体的表达式。|没实现|
|DbApplyExpression|  
|只支持select语句，返回,SelectStatement|
|DbUnionAllExpression|  
|只支持select语句，返回,UnionFragment,，左右子查询分别是个SelectStatement|
|DbSortExpression|  
|只支持select语句，返回,SelectStatement，对每一个排序字段生成一个SortFragment|
|DbSkipExpression|  
|只支持select语句，返回,SelectStatement，后面拼上 limit 语法|
|DbQuantifierExpression|  
|没实现|
|DbProjectExpression|子查询|只支持select语句，返回,SelectStatement|
|DbNewInstanceExpression|给定类型的新实例|只支持select语句，返回,SelectStatement，一般是 select ... from dual|
|DbLimitExpression|  
|只支持select语句，返回,SelectStatement，后面拼上 limit 语法|
|DbJoinExpression|  
|只支持select语句，返回,JoinFragment，拼join子句|
|DbGroupByExpression|  
|只支持select语句，返回,SelectStatement|
|DbFilterExpression|  
|只支持select语句，返回,SelectStatement|
|DbElementExpression|  
|只支持select语句，返回,SelectStatement|
|DbDistinctExpression|  
|只支持select语句，返回,SelectStatement，拼Distinct|
|DbCrossJoinExpression|  
|只支持select语句，返回,JoinFragment，拼join子句|


  


## Attachments:

[image2024-7-25_17-47-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjZhMWFkOWEzMzExZGM0YzU2IiwicmVmX2lkIjoiNjczOTVmNjY1OTNmOTljOWZmMjMxNDlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MTE2LCJleHAiOjE3ODI0MzE1MTZ9.Ghf5d5tUUPBr_qzQcuMaFSfjgH0xw3Nag7K97IvFmTg)

 (image/png)    


[image2024-7-27_18-37-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjY4OTcwYzJhZjRmNTFjZGU0IiwicmVmX2lkIjoiNjczOTVmNjY1OTNmOTljOWZmMjMxNDlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MTE2LCJleHAiOjE3ODI0MzE1MTZ9.hUv3mJaJmWAKev3OoMpRnRTIQK5d30W1z2S40QDRixI)

 (image/png)    


[image2024-7-25_17-47-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjZhMWFkOWEzMzExZGM0YzU3IiwicmVmX2lkIjoiNjczOTVmNjY1OTNmOTljOWZmMjMxNDlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MTE2LCJleHAiOjE3ODI0MzE1MTZ9.tXDbTlUQ_GADGxCUGgHkTzBQNcJDrMybBUdWOfe4Pl4)

 (image/png)    


[image2024-7-25_19-2-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjZhMWFkOWEzMzExZGM0YzU4IiwicmVmX2lkIjoiNjczOTVmNjY1OTNmOTljOWZmMjMxNDlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MTE2LCJleHAiOjE3ODI0MzE1MTZ9.REOuPRecab7HFfaYFK1Z0Sd3GcxuvscbtBqUNjTwe68)

 (image/png)    


[image2024-8-7_15-14-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjZhMWFkOWEzMzExZGM0YzU5IiwicmVmX2lkIjoiNjczOTVmNjY1OTNmOTljOWZmMjMxNDlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MTE2LCJleHAiOjE3ODI0MzE1MTZ9.lck4CMYZ02yhWGf1Wim63IqCvVEzbv19VEMJIWk5WZY)

 (image/png)    


[image2024-8-8_10-35-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTVmNjZhMWFkOWEzMzExZGM0YzVhIiwicmVmX2lkIjoiNjczOTVmNjY1OTNmOTljOWZmMjMxNDlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQ1MTE2LCJleHAiOjE3ODI0MzE1MTZ9.emG_WsRyFm49iGabxudDo96y65SdKHc4Jl74_jbA-Fc)

 (image/png)    


## Comments:

|  [](null)  ,和sql引擎的人讨论一下，sql片段的设计,Posted by zhangzhouxi at 八月 09, 2024 17:53|
|---|
|  [](null)  ,lob类型的visit做特殊处理,Posted by zhangzhouxi at 八月 09, 2024 18:26|
