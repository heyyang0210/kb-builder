# 1. 概述

本文描述

IR：    [https://pingcode.yasdb.com/pjm/items/661c961afd997db58ad92ade?](https://pingcode.yasdb.com/pjm/items/661c961afd997db58ad92ade?)  

#YDBRD-26361 【CCB转需求】PLSQL调整变量优化顺序

开发文档：  [(2456) 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67396eed728206efb92f2e5f)  

# 2. 需求分析

## 2.1 功能点分析

PLSQL中，DML语句内的词匹配规则变更，原先是【变量-》表列-》序列-》方法】修改为【表列-》变量-》序列-》方法】

(1)重名对象：表名、表别名、表列名、表列别名与变量一致（局部变量：plsql内单独定义，plsql出入参，循环临时产生的、pkg的私有变量和全局变量，局部变量优先级高于全局变量），表列名重名区分标量类型和UDT类型，如obj访问到里面的元素、record等

(2)重名位置：投影表达式、Filter表达式、TABLE表达式等各标识符位置，使用了存储过程中的变量(plsql里面单独出现，绑定参数的形式出现，跟游标关联出现)

(3)语句区分：SELECT / INSERT / UPDATE / DELETE / MERGE/SELECT [BULK COLLECT] INTO/INSERT INTO RETURN/游标关联语句

## 2.2 应用场景

场景太多，不列举，测试点里面细描述。

## 2.3 规格约束

1、数据库形态：单机，集群，分布式



# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用等价类、错误推测法进行测试，主要测试重名场景、架构的变更对历史功能的冲击，除开发设计文档单独说明的特殊处理的，进行了补充用例，其他仍采用库上已有用例，不再单独补充，  特性跟数据库形态关系不强，后面分布式从全量单机用例里面挑选改造成匿名块测试。plsql是匿名块、func、proc、pkg里面的函数、trigger里面的、obj里面的函数重名理论也无大的差异，只会将这几种穿插到用例的测试点中。

（1）重名强相关场景：

        1、重名机制，plsql仍保留预编译

        select into、select bulk into、insert into returning、显示游标跟for update关联

        2、重名机制，plsql不保留预编译

        3、表涉及的名、 局部变量名、 全局变量名识别顺序

        4、表、列-》变量-》序列-》方法识别顺序,主要关注这次调整的表、列和变量的重名的顺序

        5、安全、视图类（低）

（2）架构变更，对历史功能的影响，上车二层区分打开错误码和不打开错误码比对，三层的KT用例

（3）  梳理plsql里面不支持但sql支持的场景，可暂时不梳理，理论这种场景极少或者不存在。

## 3.2 详细测试设计

1、重名机制，plsql仍保留预编译

|一级分类|二级分类|测试点|
|---|---|---|
|select into|1、表（重名跟表关系不大，不会覆盖所有的表类型）,2、列：表列进行四则运算、表列四则运算后的别名跟变量同名、变量四则运算、函数对表列进行处理,3、列类型,4、表涉及的名、 局部变量名、 全局变量名识别顺序,5、表列混合，表列名同名等,6、一个语句里面重名存在的次数,7、schema.表名 跟 pkg.元素重名等、表.列跟pkg.元素重名,8、动态执行,9、  表列跟变量同名，但是投影列使用的方式只能是变量时，如col_udt(1) col_obj.元素,是元素优先（低）,,|局部变量的位置区分plsql内、plsql的出入参、for循环临时产生的,穿插放在不同的用例里；pkg的私有变量和公有变量。区分重名次数；位置：投影表达式、Filter表达式、TABLE表达式等各标识符位置,1、表,表名跟局部变量名重名,表名跟全局变量名重名,表别名跟局部变量名重名,表别名跟全局变量名重名,表分区名跟变量重名,2、列名,列名跟局部变量名重名,列名跟全局变量名重名,列别名跟局部变量名重名,列别名跟全局变量名重名,3、列类型,标量类型,udt类型,4、表列+局部变量+全局变量同名,表列不存在，局部变量存在,表列不存在，局部变量不存在，全局变量存在,表列不存在，局部变量不存在，全局变量不存在,表列+局部变量+全局变量均存在且同名,5、投影表达式、Filter表达式、TABLE表达式,（1）  投影表达式,纯列：标量、udt、obj跟变量同名（用例16）,表列+变量间隔交替，表列跟其他变量同名,t.col_udt 跟rec.元素同名，t是表别名,t.col_obj跟rec.元素同名，t是表别名,t.obj.元素跟变量rec.obj.元素同名,t.col_obj.col_obj.employee_id employee_id的别名跟变量同名，t.col_obj.col_obj.employee_id跟rec.obj.obj.元素的变量同名（表列是obj-obj）（用例21）,col_obj.col_udt跟rec.元素同名（obj-udt做表列）,投影是高级包处理过：DBMS_XA.XA_PREPARE(col_obj)，col_obj是表列跟变量重名,自定义函数、内置函数等,（2）Filter表达式,where a=xx，b=xx,a是列名跟变量重名，b就是变量,where 表别名.列.列的元素 =xx，表别名.列.列的元素跟obj.obj.里面的元素重名,where a=xx,xx是record.元素跟表别名.列同名或者obj.元素跟表别名.列同名,where a=xx,xx是record.record.元素跟表别名.列同名.列里面的元素,where a=xx,xx是obj.obj.元素跟表别名.列同名.列里面的元素,（3）TABLE表达式,用例21：,table函数展开的是nt2.EMPLOYEE_ID ,nt2.FIRST_NAME,NT2.LAST_NAME，同obj.元素(表列是udt-Obj）,table函数展开的是column别名同数组变量var_varry(表列是udt-varray）,用例22：,table函数处理的是piplined函数：列COLUMN_VALUE跟变量同名，列优先级高；变量跟piplined函数同名，变量优先级高,table函数处理的是内置函数PX_OBJ、PX_CHANNEL，展开的列同局部变量，如SID, SQL_ID, THREAD_ID, STAGE_ID, TYPE,用例13：内置udt,table函数处理后的别名t1 t2 t3 t4存在同名变量，列column_value geom存在同名变量，table处理的列也存在别名如col_geom,如select t3.col_int COL_INT, t4.column_value select t3.col_int COL_INT, t4.column_value column_value , t3.geom  GEOM INTO COL_INT,COLUMN_VALUES,GEOM from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_26361_select_into_13 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4 , t3.geom  GEOM INTO COL_INT,COLUMN_VALUES,GEOM from (select t1.col_int col_int, t2.path path , st_astext(t2.geom,0) geom from tb_YDBRD_26361_select_into_13 t1, table(st_dump(t1.col_geom)) t2) t3, table(t3.path) t4;,6、for循环临时产生的,表别名或列名与循环临时产生的变量重名：标量,表别名或列名与循环临时产生的变量重名：obj、udt|
|select bulk into|select  employee_id,department_id,salary   bulk collect into type_002  from table(type_001);type_001是udt的变量，投影列跟变量同名||
|insert into returning|return子句后面的列跟变量重名,投影表达式的点改造成return后面的表达式|备注：表名跟变量重名，历史版本都是表名优先级高,           return的列不支持别名,补充：循环产生的变量作为values(变量) return 变量，values(非变量) return 变量|
|游标跟for update关联,显示游标|(1)表或者列跟游标的入参参数同名，优先级是表列,(2)游标的入参参数跟游标外的变量同名，优先级是游标入参,(3)for访问游标变量产生的变量跟表列同名,游标关联的语句，比如返回udt等，是sql层不支持的|独有的：,（1）表或者列跟游标的入参参数同名，优先级是表列,1、游标return xxx,xxx跟表列重名,xxx是类型，相关性低,2、update的语句表名，表别名，列名存在同名,3、update后面set的值是子查询(select 表列的子查询 + select 变量的子查询)，表列的子查询里面表列跟变量含重名：标量、udt，访问区分udt或者udt(1)、obj，访问区分obj或者obj.元素,4、投影列和where 限定条件处跟游标入参col_xxx同名，表列优先：标量、udt、obj、rec、obj->obj嵌套、obj->udt嵌套、udt->obj(obj支持比较),5、表名跟游标入参相同,6、表列不支持的用法，同名时优先变量：,update set col_int=col_udt(1)或者col_int=col_obj.元素,Y优先是变量，表列不支持此用法,udt(1) obj.元素 rec.元素(入参跟表列同名时，作为投影列，优先的是变量）|


2、重名机制，plsql不保留预编译

|一级分类|二级分类|测试点|
|---|---|---|
|INSERT,1、insert into values,2、insert into select,3、insert all into|insert into tablename  alis_name(col_name) values(col_value);本身tablename，col_name就以表的优先，简单覆盖一个，alis_name会存在重名解析问题。,insert into select ，因select支持程度，公共点理论都支持。,insert all into含select的部分，公共点理论都支持。,1、表,2、列,3、列类型,4、表涉及的名、 局部变量名、 全局变量名识别顺序,5、表列混合，表列名同名等,6、一个语句里面重名存在的次数,7、schema.表名 跟 pkg.元素重名等、表.列跟pkg.元素重名,8、动态执行,,|,,特殊：insert ON DUPLICATE KEY UPDATE 列=(子查询)，mysql的功能，类似oracle的merge，动态绑定里面会简单覆盖其重名机制|
|UPDATE|多表修改，表被修过的值或者where限定条件那是子查询||
|DELETE|多表删除，where限定条件那是子查询||
|MERGE|源表，查询和on的地方重名，where的地方会重名,目标表，是match语句、not matched会存在重名,MERGE INTO employees3 b,USING (  SELECT xxx FROM employees where xxx  ) a,ON (a.employee_no=b.employee_no),WHEN MATCHED THEN UPDATE SET b.sex=a.sex,b.entry_date=a.entry_date,b.xxx=  (select xxx from where xxx),WHEN NOT MATCHED THEN INSERT VALUES (a.branch,a.department,a.employee_no,a.employee_name,a.sex,  a.entry_date  );,,MERGE INTO employees_merge b,USING (SELECT * FROM employees) a,ON (a.employee_no=b.employee_no),WHEN MATCHED THEN UPDATE SET b.sex=a.sex,b.entry_date=a.entry_date,WHERE a.department='008' AND a.branch=  (select '008' from where xxx),DELETE WHERE b.department=  (select '008' from where xxx);,,MERGE INTO employees_merge b,USING (SELECT * FROM employees) a,ON (a.employee_no=b.employee_no),WHEN MATCHED THEN UPDATE SET b.sex=a.sex,b.entry_date=a.entry_date,WHERE a.department='008' AND a.branch='0201';,|fifter、投影出现的位置，见左边标记为红色的地方；,新增独有的：,(1)on处,1、表列跟变量重名、表别名.元素跟rec.元素重名（标量）,2、obj：t.表列.元素跟rec.元素.元素重名、t.表列跟rec.元素重名,     udt：不支持比较，udt(1)优先变量,     obj->obj：表别名.表列.元素.元素跟变量a下面的元素同名,(2)update set a=b，a重名,(3)insert处跟rec.元素等重名|
|跟游标关联|显示游标（重点）,动态游标,隐式游标,关注：游标关联的语句，比如返回udt等，是sql层不支持的,fetch 、FETCH c_employees BULK COLLECT INTO |7、  游标变量名或者游标名如果和游标查询语句的表alias或者列alias存在同名,https://jira.yasdb.com/browse/SAISSUE-120 ,8、  隐式游标的投影列跟变量重名，后面rec.投影列赋值给变量,显示游标：,同for update游标的用例测试点，区别就是for update不支持，显示游标是支持的，也不涵盖where current of的点,动态游标：,基本同显示游标，去掉了不支持的入参相关测试点,独有的：open cur for select，还要覆盖测试,open cur for sql_text； sql_text前面定义，区分含绑定参数和不含绑定参数。(主要测试的第一种，第二种简单覆盖）,打开重名，不重名，再重名，不重名，交替20次,重名和不重名的相互赋值,隐式游标：,显示游标的子集（游标入参相关的去掉）,|
|forall|insert into tt1(a) values(a(i));,重名的点很少，同insert语句。,insert into tt1(a) select a  from tt1; 含select,公共点理论可以复用,update ，set或者where处可以是子查询，公共点理论可以复用,delete，where处可以是子查询，公共点理论可以复用|forall产生的临时变量|
|动态语句里面执行,EXECUTE IMMEDIATE into/EXECUTE IMMEDIATE bulk into|匿名块 + 静态SQL，静态SQL的重名点同上，关注绑定参数级联查找,|select into:,0、不含绑定参数，匿名块里面含重名（列 列别名  表名 表别名）,1、投影列、into、where处含绑定参数,2、select into前的变量初始化区域含绑定参数 + 投影列、into、where处含绑定参数（投影列和fifter是变量跟表列间隔）,3、标量和udt展开列跟变量重名（obj展开，udt的table函数），table函数处理表列或者绑定的变量,4、动态执行多层嵌套,5、obj的方法里面含动态执行，动态执行在投影列、into、where处含绑定参数,6、触发器里面适用动态执行，动态执行在投影列、into、where处含绑定参数,7、不同位置，用同一绑定参数  （初始化区域跟dml里面用的绑定参数一样，之前的用例基本是dml语句里面绑定参数一样）,补充：8、同一个变量，不同位置--公共的用例7 、8含有，不再补充。|


3、表列-》变量-》序列-》方法识别顺序

     1、2是表列跟变量的顺序测试，3测试变量-》序列的优先级，变量-》方法的优先级，表列不存在-》变量不存在-》序列不存在，表列不存在-》变量不存在-》序列存在。

4、安全、视图类

     select sql_text from v$sql where sql_text like '%表名%';

     长度8k，大于8k，大于2M。

5、单独处理的其他非重名的地方

(1)record

|rec在insert 、merge 的values后、insert into的values后支持，insert all into、insert ON DUPLICATE KEY UPDATE的values后面不支持|
|---|
|rec在insert、 merge、 insert into return里面绑定参数，动态直接绑定语句、动态绑定匿名块且匿名块里面含此语句|
|insert into return里面使用rec,表列是标量，单列,insert into return里面使用rec,表列是标量，多列,insert into return里面使用rec,表列是obj，多列|
|tablename (colname) values rec  ，不支持，拦截|
|values( record)，record带了括号，不支持，insert、 insert return、 merge的拦截用例,record是表列类型、给某列插入数据，record是单个列的record|
|selec  t  into rec直接使用和绑定参数|


（2）  access表达式  ，function返回值，下标访问和成员变量都不支持，拦截用例

   出现在dml语句是拦截，赋值仍支持，dml语句涵盖下select ，update ,cursor关联的select即可，出现在投影列或者where限定条件处，直接使用或者using 绑定参数给传入到dml的投影列或where限定处。

(3)for update cusor

重名的功能测试就能覆盖到此逻辑。

### 3.2.1 测试设计



### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是，已考虑并发，详细测试点见下面|
|DFR|否，跟DFR关系不大，不涉及|
|HA|否，跟HA关系不大，不涉及|
|KT kill测试|是，已考虑KT，详细测试点见下面|
|一致性|否，跟一致性关系不大，不涉及|
|三方测试工具  
(sqltest，sqlancer)|否，跟三方工具关系不大，不涉及|
|压力|否，主要是功能重名解析，跟压力关系不大，不涉及|
|可维护性|否，不涉及|
|安全|是，功能用例上面已涵盖，语句大小超过2M|
|性能|否，不涉及性能|
|长稳|否，主要是功能重名解析，不涉及|


并发和KT：重名跟并发和KT的关系不大，挑选如下的点覆盖

select into 、select bulk into、insert into return、显示cursor+for update

各个功能里面挑选，表 表别名 列 列别名重名的用例（区分下标量、  udt 、 循环产生的变量 、动态执行），同时并发查询 v$sql视图。

insert、update、delete、merge、forall、游标

各个功能里面挑选，表 表别名 列 列别名重名的用例（区分下标量、  udt 、 循环产生的变量 、动态执行,update和delete区分单表和多表），同时并发查询 v$sql视图。

补充：加上重编译的  逻辑，依赖的type等变更，ddl或者alter等，让重编译走重名。

# 4.   **测试用例**   电子表格

# 5.   **测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **7. 工作量评估**

工作量：X  *人天*

计划测试完成时间：