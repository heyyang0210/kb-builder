Created by 胡晓畔 on 四月 01, 2024

IR链接：      [YDBRD-9418](https://jira.yasdb.com/browse/YDBRD-9418?src=confmacro)    -  【2023.1】存储过程支持External Procedure  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

SR链接：    [YDBRD-1816](https://jira.yasdb.com/browse/YDBRD-1816?src=confmacro)    -  支持C语言的External Procedures  完成

涉及版本：23.1 ，23.2

部署形态覆盖：单机 集群 分布式暂不支持

--明确以上测试范围

--集群支持外置UDF JAVA和单机支持外置UDF C同时转测，共同合入主干后，集群天然支持外置UDF C

  


##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

需要将C语言程序打包成动态链接库，创建对应的library对象后，再在创建外置udf时使用该library对象。调用外置udf时运行C语言函数，返回结果。

- 通过yex_server执行C语言函数；
- 支持参数按值传递和按引用传递（由in，out，in out决定）；
- 由于C语言没有异常捕获机制，编写C语言程序时需要注意不要引发异常，否则会导致yex_server程序core dumped（yex_server之后会由yasdb的守护线程重新拉起），yex_server core 不会影响yasdb；
- 系统表和权限、审计支持同extProc JAVA一样；


**C语言的extproc**     语法：

```
<span class="token rule">syntax</span>::<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">CREATE</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">OR REPLACE</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">FUNCTION</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">schema</span> <span class="token string" style="color: rgb(126,198,153);">"."</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">function_name</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token string" style="color: rgb(126,198,153);">"("</span>  <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">argument_define</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">","</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">argument_define</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span>  <span class="token string" style="color: rgb(126,198,153);">")"</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">RETURN return_datatype</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">IS</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">AS</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token rule">call_spec</span> <span class="token string" style="color: rgb(126,198,153);">";"</span>
```

```
<span class="token rule">syntax</span>::<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">LANGUAGE C</span> <span class="token operator" style="color: rgb(103,205,204);">|</span> <span class="token rule">EXTERNAL</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">NAME c_string_literal_name</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">LIBRARY</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">schema</span><span class="token string" style="color: rgb(126,198,153);">"."</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">library_name</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">LIBRARY</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">schema</span><span class="token string" style="color: rgb(126,198,153);">"."</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">library_name</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">NAME c_string_literal_name</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span>
```

**IS/AS EXTERNAL**    
  oracle为了兼容老版本语法，建议使用IS/AS LANGUAGE代替；

**c_string_literal_name**    
  c语言函数的名称,默认全转为大写，如需要区分大小写，请使用双引号。如果省略，默认为外置udf的名称；    
  名称需要为合法的标识符，最大64字节；

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1.入参接口组，出参接口组，返回值接口组 共计45个接口组，yep接口通过yacli.h提供的用于出入参的yep接口组进行函数的出入参控制；

2.extProc C通过YacHandle作为C函数的唯一入参；

3.C函数需要YacResult作为返回值；

如果用户C函数不满足上述要求，可能会导致执行结果错误甚至发生异常导致yex_server程序core dumped（yex_server之后会由yasdb的守护线程重新拉起）。

  


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

|应用场景|大类|备注|
|---|---|---|
|外置UDF单独使用|需要外部进程调用外部C函数的场景|  
|
|外置UDF返回值结合表使用|insert into的值|  
|
||update，delete|  
|
||视图|  
|
|DQL查询应用|做绑定参数使用|  
|
||与普通函数嵌套使用|  
|
||嵌套普通UDF|  
|
|PLSQL|匿名块|  
|
||procedure|  
|
||UDP|  
|


  


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|测试范围|大类测试点|  
|
|---|---|---|
|语法|覆盖create LIBRARY语法路径 ：正确/不正确关键字，合法/非法name|  
|
|  
|LIBRARY考虑Windows  DLL格式库和 Linux SO格式库 |  
|
|  
|长度限制|  
|
|审计和权限|create，drop library的相关审计和权限测试|  
|
|yep 接口|yep 接口覆盖，入参，出参，返回值|  
|
|  
|覆盖对应/ 不对应数据类型|  
|
|  
|特殊值|  
|
|  
|容错：不对应类型，不匹配长度，错误个数，空指针|  
|
|C函数|正常/异常场景测试|  
|
|  
|嵌套测试|  
|
|  
|编译测试|  
|
|yex_server进程|kill 进程，kill session |  
|
|主备|主备切换后UDF执行情况|  
|
|UDF应用|PLSQL应用|  
|
|  
|表，视图 ，查询应用|dml,dql,嵌套内置函数|
|  
|外置UDF-C嵌套 C和嵌套JAVA|  
|
|集群支持情况|集群支持与单机一致|  
|
|性能|外置UDF性能与普通function性能对比|  
|


  


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

CT，KT测试，覆盖以下场景

1.create drop  UDF应用并发

2.4096个 LIBRARY的 create drop 访问并发

3.4096个 LIBRARY的 create drop 访问与外置UDF执行并发

  


  


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133592238#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

按测试详细设计覆盖所有测试点，在二层CI看护用例

功能使用Guider+yasft 测试框架

CT KT使用Yastest Dfx 测试框架

已看护的自动化用例见文本用例梳理     [外置UDF支持C文本用例](https://conf.yasdb.com/pages/viewpage.action?pageId=138572870)  

  


  


  


  


  


  


  
