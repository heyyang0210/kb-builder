# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/67c917d27ce85d5a075752b2?](https://pingcode.yasdb.com/pjm/items/67c917d27ce85d5a075752b2?)  

#YDBRD-38767 PIPELINE函数支持record类型

  [https://pingcode.yasdb.com/pjm/items/67c918a97ce85d5a075753e6?](https://pingcode.yasdb.com/pjm/items/67c918a97ce85d5a075753e6?)  

#YDBRD-38771 支持多PIPELINE执行

# 2. 需求分析

## 2.1 功能点分析

|做返回值的数组支持record||修改内容|测试点分析|
|---|---|---|---|
|1|定义|record的来源|直接定义，隐式定义|
|2||使用场景|普通函数,PKG函数|
|3||子类型|record的类型，重点覆盖如下：,变长类型,lob类型,UDT类型,带精度的浮点类型,GIS类型,record类型,时区类型,json，xmltype（补充下）,UDT的成员还有UDT，多层嵌套时的类型推导|
|4||默认值|做为子类型的record，在定义时指定有默认值|
|5|返回值|类型推导和校验|多层继承的record，通过返回值验证类型推导是否异常|
|6||返回record的形式|变量（直接返回变量和数组的子元素）|
|7|||构造函数|
|8|||自定义函数表达式|
|9|||按record元素返回|
|10|调用|直接查询||
|11||做游标的打开语句（交叉覆盖）|显式游标|
|12|||隐式游标|
|13|||游标变量|
|14||查询复杂度，需要覆盖关联查询，DML语句查询|多表关联|
|15|||多个pipelined函数关联|
|16|其他场景|返回值为数组+数组+record||


|多表关联查询|||本次是否支持|
|---|---|---|---|
|1|关联对象|同一个pipelined函数|支持|
|2||不同的pipelined函数|支持|
|3||注意下普通function和pkg.func的混合使用||
|4|覆盖下已经支持的DQL算子|操作符|支持|
|5||布尔表达式|支持|
|6||DQL算子|支持|
|7||子查询|支持|
|8||CTE|支持|
|9|覆盖下用在DML语句的filter或子查询中|参考需求调研中的实例分析|支持|


## 2.2 应用场景

如上述

## 2.3 规格约束

record类型中的元素类型须为标量类型或全局UDT类型

# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法有边界值，等价类，table返回值类型交叉覆盖，关注变长类型，lob类型，udt类型

## 3.2 详细测试设计

||一级测试点|二级测试点|三级测试点|
|---|---|---|---|
|1|record来源|%rowtype显式定义了返回值的游标变量类型的对象,直接使用类型和继承类型|pkg.func+nstb+record+varchar|
|2||%rowtype继承cursor,有入参无入参|func+varray+record+nvarchar|
|3||%rowtype继承表列|pkg.func+nstb+record+varchar+number|
|4||%rowtype继承视图列|func+varray+record+nvarchar+clob|
|5||%rowtype继承，但对象为表的同义词,包括同个user下的和不同user下的|pkg.func+nstb+record+varchar+blob|
|6||显式定义的record，无默认值|func+varray+record+varchar+clob|
|7||显式定义的record，有默认值|func+varray+record+varchar+gis类型|
|8||%type继承record变量|pkg.func+nstb+record+object|
|9||%type继承for循环中隐式定义的record变量|func+var+nstb+record+varray|
|10||%type继承数组的成员类型|pkg.func+nstb+var+record+nstb|
|11||%type继承形参的类型|func+var+index by var+record+obj|
|||多层继承的record做数组类型的子类型|显式定义的record，其列类型为%type继承表列|
||||显式定义的record，其列类型为%type继承pkg公有变量|
|12|返回值|返回record类型的变量|pkg.func+nstb+record+隐式record|
|13||返回数组变量的子元素是record类型|pkg.func+var+record+全局nstb|
|14||返回for循环中隐式定义的record|func+nstb+record+全局varray|
|15||返回构造函数|pkg.func+var+record+显式record指定默认值，走默认值逻辑和不走默认值逻辑两种都关注下|
|16||返回自定义函数表达式|pkg.func+nstb+record+object|
||||func+nstb+record+object|
||||子过程函数|
|17||按record元素返回|func+varray+record+varchar+clob|
|18|异常场景|record类型校验|传record类型不一致，但子类型完全一致|
|19|||传record类型不一致，子类型不一致但可以隐式转化|
|20|||传record类型不一致，子类型一致但精度不一致|
|21|||传record类型不一致，子类型不可隐式转换（区分下udt类型和非udt类型）|
|22|多表在pipelined语句关联查询,这里需要关注下查询对应测试点下的单表，多表，关注下pipelined的返回值和入参交叉覆盖，用例中的查询方式覆盖直接查询和做游标的不同情况|操作符：in/not in、exists/not exists 、between and、like/not like、limit等|返回值类型：数组+varchar,相同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标中|
||||返回值类型：数组+nvarchar/pkg.func+nstb+record+varr（覆盖子句是pipelined的直接返回值和返回值的再展开）,不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标中，open打开游标|
|23||布尔表达式：== 、 != 、 >= 、 > 、 < 和 <=|返回值类型：数组+obj+varchar，number,相同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在游标变量中|
||||返回值类型：pkg.func+varr+nstb+varchar/pkg.func+nstb+record+varchar（覆盖子句是pipelined的直接返回值和返回值的再展开）,不同的pipelined函数在语句中查询,入参相同/不同，有多个入参,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标中|
||||返回值类型：数组+number/func+varr+object,相同或不同的pipelined函数在语句中查询，用在DML语句中，覆盖delete，merge into（set子句，filter子句）,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标中，for循环打开游标|
|24||多表连接，子查询|返回值类型：func+varr+number/func+varr+object,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标，游标指定入参，for循环打开游标,语句用于insert时无异常|
|||多表连接，set|**UNION**,返回值类型：pkg.func+nstb+varchar/func+nstb+clob,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标，游标无入参，for循环打开游标,语句用于update时无异常|
||||**UNION ALL**,返回值类型：func+nstb+pkg1.record+varchar/pkg1.func+nstb+clob,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标，for循环打开游标,语句用于delete时无异常|
||||**INTERSECT**,返回值类型：func+nstb+pkg1.record+clob/pkg2.func+nstb+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标select into,语句用于insert时无异常|
||||**INTERSECT ALL**,返回值类型：pkg1.func+nstb+pkg1.record/pkg1.func+nstb+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在游标变量,语句用于update时无异常|
||||**MINUS/EXCEPT**,返回值类型：pkg1.func+nstb+pkg2.record/pkg2.func+nstb+nvarchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标,语句用于insert时无异常|
||||**MINUS ALL/EXCEPT ALL**,返回值类型：pkg1.func+nstb+pkg2.record+nclob,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标,语句用于update时无异常|
|||多表连接，join|**内连接：inner join&cross join**,返回值类型：func+pkg1.nstb+record+nclob/func+pkg1.nstb+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在游标变量,语句用于insert时无异常|
||||**外连接：left join&right join&full join**,返回值类型：pkg1.func+nstb+record,varchar/func+pkg1.nstb+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标,语句用于update时无异常|
||||**指定外连接：(+)**,返回值类型：pkg2.func+pkg2.nstb+record+clob，varchar，gis类型/func+pkg1.nstb+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标,语句用于insert时无异常|
|||排序ORDER BY|指定升序或降序,返回值类型：pkg2.func+pkg2.nstb+record+clob，varchar，gis类型/pkg1.func+pkg1.nstb+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在游标变量,语句用于insert时无异常|
|||分组GROUP BY,写法可参考：,SELECT 1,year,month,CONCAT(year,month),SUM(amount),FROM sales_info,GROUP BY year,month,HAVING SUM(amount)>(SELECT MIN(price*50) FROM product);|group by，列是子集："SELECT col ,COUNT(*) FROM table GROUP BY col, col2；",返回值类型：pkg2.func+pkg1.nstb+record+clob，varchar，gis类型/pkg1.func+pkg2.nstb+varr+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标,语句用于insert时无异常|
||||group by，列数据是子集："SELECT LPAD(col), COUNT(*) FROM table GROUP BY col；",返回值类型：pkg2.func+varr1+varchar/pkg1.func+nstb+varr2+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标，for循环打开,语句用于insert时无异常|
||||group by，having,返回值类型：pkg2.func+varr1+varchar/pkg1.func+nstb+varr1+varchar,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标，for循环打开,语句用于insert时无异常|
|||CASE|可以出现的位置：,simple_case_expression = expr { WHEN comparison_expr THEN return_expr }.,searched_case_expression = { WHEN condition THEN return_expr }.,else_clause = ELSE else_expr.,返回值类型：func+pkg1.record1+varchar/func+nstb+varr1+pkg1.record1,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在游标变量，强类型,语句用于insert时无异常|
|||LIMIT|limit和offset子句中使用子查询,返回值类型：pkg2.func+pkg1.record1+varchar/pkg1.func+nstb+varr1+pkg1.record2,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在游标变量，弱类型,语句用于insert时无异常|
|||CTE|返回值类型：pkg2.func+pkg2.record1+varchar/func+nstb+varr1+pkg1.record2（record关联到同一张表上）,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在显式游标,语句用于insert时无异常|
|||CONNECT BY,样例：,SELECT ,  e.employee_name,,  d.department_name,,  LEVEL,FROM employees e,JOIN departments d ON e.department_id = d.department_id,START WITH e.manager_id IS NULL  -- 假设有 manager_id 字段,CONNECT BY PRIOR e.employee_id = e.manager_id;|返回值类型：func+pkg1.record1+varchar，clob/func+nstb+varr1+pkg1.record2+clob,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标,语句用于insert时无异常|
|||取样,有多表关联的时候，取样结果无异常|返回值类型：func+pkg1.record1+varchar，clob/func+nstb+varr1+pkg1.record2+clob,record1,相同/不同的pipelined函数在语句中查询,入参相同/不同,关联数量覆盖2及以上,查询语句覆盖直接查询和用在隐式游标,语句用于insert时无异常|
|||分区（预计报错）||
|25|复杂场景|从pipelined创建一个view，再用view与pipelined函数做关联查询||
|26||在覆盖下普通表和多个pipelined在同一子句的场景|普通表与pipelined中的变量有关联|
|27|||普通表与pipelined中的变量无关联|
|28|||普通表投影列与pipelined做pipelined函数的入参|
|29|||pipelined函数1的投影列做函数2的入参|
|30|||普通表与pipelined在同一子句，pipelined中有对普通表的DML|
|31|||多表关联的上限摸底|
||||pipelined函数做pipelined函数的入参（预计拦截报错）|
||||重载的pipelined函数做多表查询|
||||放开的65534的varchar和raw在场景中应用|
||||指定算子时看护执行计划,USE_NL,USE_HASH,USE_MERGE|
||||投影列宽度超过64k时，检查是否有异常|
||||构造管道中数据超出上限，检查下报错|
||||返回性能存在差异时，时序不一致时检查是否有异常|
||||结合access表达式，结合obj方法访问pipelined函数时，检查是否有异常|
||||打开并行开关，检查返回结果是否有异常|
||||看一下表函数的覆盖情况，关联普通表，表函数|
||||n类型的返回结果是否有异常，修改字符集时，是否有异常，非n类型转成n类型，检查结果是否有异常，需要检查类型|
||||23.2版本上同步算子问题单|
||||暂不关注性能但是先看下外场谓词的问题单|


|系统级DFX分类|是否涉及|
|:---|:---|
|系统级DFX分类|是否涉及|
|CT|是,1、前置建依赖表，包括各种变长类型，lob类型，udt类型，创建pipelined函数，返回值类型为table+record，table+varchar，table+clob,2、关联查询pipelined函数，一行有相同的，一行有不同的，一行有pipelined函数与表关联查询，包括直接查询和游标查询,3、将查询语句运用到DML语句中，做增删改查,4、对关联表有DDL，增删列或truncate,5、修改pipelined函数的定义,6、后置中删除依赖对象，再删除pipelined函数，检查内存无泄漏  
|
|KT|  
复用CT用例|
|长稳|复杂场景的功能用例改写，覆盖table of record和查询时一行有多个pipelined函数  
|
|一致性|否  
|
|三方测试工具  
(sqltest，sqlancer)|混沌测试中增加pipelined函数和表函数用例（优先级低）    
|
|安全|否  
|
|DFR|否  
|
|HA|  
否|
|压力|  
否|
|性能|  
否|
|升级|否|
|可维护性|  
否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；用例如下：


  [YTP](https://ytp.yasdb.com/#/workSpace/approval?vettingId=vet_GILUUysY&theme=38767pipelined%E4%B8%8A%E5%BA%93)  

# 5. 测试框架设计

- *当前环境满足需求*


# 6. 测试环境说明

x86环境

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

评审意见：

1. json，xmltype（补充下），UDT的成员还有UDT，多层嵌套时的类型推导
1. 投影列宽度超过64k时，检查是否有异常
1. 构造管道中数据超出上限，检查下报错
1. 返回性能存在差异时，时序不一致时检查是否有异常
1. 结合access表达式，结合obj方法访问pipelined函数时，检查是否有异常
1. 打开并行开关，检查返回结果是否有异常
1. 看一下表函数的覆盖情况，关联普通表，表函数
1. n类型的返回结果是否有异常，修改字符集时，是否有异常，非n类型转成n类型，检查结果是否有异常，需要检查类型
1. 23.2版本上同步算子问题单
1. 暂不关注性能但是先看下外场谓词的问题单
1. 混沌测试中增加pipelined函数和表函数用例（优先级低）


