Created by 徐千禧, last modified on 四月 02, 2024

sr:    [YDBRD-29068](https://jira.yasdb.com/browse/YDBRD-29068?src=confmacro)    -  PL语言中静态SQL支持CTE语法  编码完成

##   [1. 总述](#1-总述)  

源于博时基金市场需求，主要针对存储过程静态SQL支持CTE语法功能。

根据IR的客户场景用例，除了静态SQL需要支持CTE语法，CURSOR也同样需要支持CTE语法。

###   [1.1 需求来源](#11-需求来源)  

根据IR的客户场景用例，除了静态SQL需要支持CTE语法，CURSOR也同样需要支持CTE语法。

​	需求范围：单机。

###   [1.2 调研文档](#12-调研文档)  

目前YashanDB针对CTE语法的实现情况：    [Common Table Expression - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Common+Table+Expression)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|支持静态SQL解析CTE语法|除了CTE COLUMNS为列优先，其余QUERY为变量优先；语法最后部分的SELECT需要对INTO进行改写。|是|是|----|
||支持CURSOR内的CTE语法|同上述，但不允许出现INTO关键字。|是|是|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|----|
||性能场景2|----|是/否|是/否|----|
|可用性|恢复场景|----|是/否|是/否|----|
|可靠性|故障场景|----|是/否|是/否|----|
|可维可测|DFX功能1|----|是/否|是/否|----|
||DFX功能2|----|是/否|是/否|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|导入导出工具|----|----|是/否|----|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|CTE语法|cte_clause=query_name ["("c_ailas{","c_ailas}")"] AS "(" subquery ")".|----|是|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. ORACLE允许CURSOR内带INTO关键字，仅语法支持，我们报错；
1. 针对CTE NAME，我们报错信息为“invalid variant”，ORACLE为“invalid table”
1. CTE语法最后的SELECT子句不允许用括号括起，ORACLE支持。


##   [4. 特性](#4-特性)  

  


![](https://conf.yasdb.com/download/attachments/43190044/cte_not_supported_syntax1.png?version=1&modificationDate=1611716222000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI0OTMsImV4cCI6MTc4MjMxMzI5M30.51hVrrcRSoGji0GBVJASW0HerFQkc_yHiikZXlkRZ3w)

![](https://conf.yasdb.com/download/attachments/43190044/cte_not_supported_syntax2.png?version=1&modificationDate=1611716225000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI0OTMsImV4cCI6MTc4MjMxMzI5M30.51hVrrcRSoGji0GBVJASW0HerFQkc_yHiikZXlkRZ3w)

  


游标适配情况：

|种类|SQL|
|---|---|
|隐式游标|declare    
  begin    
  FOR file IN (with cte(a) as (select 1 from sys.dual) select a from cte) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|
|显示（静态）游标|```
<span class="token keyword" style="color: rgb(204,153,205);">DECLARE</span>
<span class="token keyword" style="color: rgb(204,153,205);">CURSOR</span> c1<span class="token punctuation" style="color: rgb(204,204,204);">(</span>id <span class="token keyword" style="color: rgb(204,153,205);">INT</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token keyword" style="color: rgb(204,153,205);">IS</span> with cte(a) as (select 1 from sys.dual) select a,id from cte<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
resultStr VARCHAR<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">200</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
<span class="token keyword" style="color: rgb(204,153,205);">FOR</span> v_sal <span class="token keyword" style="color: rgb(204,153,205);">IN</span> c1(<span class="token number" style="color: rgb(240,141,73);">2</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token keyword" style="color: rgb(204,153,205);">LOOP</span>
resultStr <span class="token operator" style="color: rgb(103,205,204);">:=</span> resultStr<span class="token operator" style="color: rgb(103,205,204);">||</span>v_sal<span class="token punctuation" style="color: rgb(204,204,204);">.</span>a<span class="token operator" style="color: rgb(103,205,204);">||</span>v_sal<span class="token punctuation" style="color: rgb(204,204,204);">.</span>id<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span>resultStr<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span> <span class="token keyword" style="color: rgb(204,153,205);">LOOP</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|
|动态游标（静态SQL\  ~~动态SQL~~  ）|DECLARE    
  TYPE cursor IS REF CURSOR;    
  cur cursor;    
  TYPE record1 IS RECORD (    
  c1 int    
  );    
  rec1 record1;    
  BEGIN     
  OPEN cur FOR with cte(a) as (select 1 from sys.dual) select a from cte;    
  FETCH cur INTO rec1;    
  DBMS_OUTPUT.PUT_LINE(rec1.c1 );    
  CLOSE cur;    
  END;    
  /|
|系统游标|declare    
  a sys_refcursor;    
  a1 a%type;    
  TYPE AR IS RECORD (    
  f1 int    
  );    
  b AR;    
  begin    
  open a for with cte(c) as (select 1 from sys.dual) select c from cte;    
  a1 := a;    
  fetch a1 into b;    
  dbms_output.put_line(b.f1);    
  close a;    
  end;    
  /|


  


  


  


  


  


  


  
