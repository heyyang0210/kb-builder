Created by 李美娥, last modified on 十一月 14, 2024

# 1. 概述

本文描述

IR：        [https://pingcode.yasdb.com/pjm/items/66115652579a3edb84d68bd1](https://pingcode.yasdb.com/pjm/items/66115652579a3edb84d68bd1)    ?    
  #YDBRD-19151 支持FOR UPDATE游标功能

for update游标的定义：  当 SELECT FOR UPDATE 与显式游标关联时。（  When     `SELECT`         `FOR`         `UPDATE`     is associated with an explicit cursor, the cursor is called a   FOR     UPDATE     cursor）

# 2. 需求分析

## 2.1 功能点分析

      为避免游标open后但未返回前，其他的session对表进行更改或删除操作导致cusor的查询无法感知，引入功能for update of+where current of。使用for update 子句，在open返回以前的活动集的相应行上会加上互斥锁，锁会避免其他会话对活动集中的行进行修改，直到进行roolback或者commit或者关闭游标为止。     

     扩展：

    1、动态游标支持for update,OPEN cur2 FOR SELECT * FROM 表名 for update;  

          REF CURSOR + sys_refcursor两种动态游标均支持for update，且两种符合一定条件下可相互赋值，主要关注事务相关，赋值可简单覆盖（比如一个带for update，一个不带，带赋值给不带的）

    2、隐式游标支持for upate,for cur_test in(select * from 表名 for update) loop

## 2.2 应用场景

(1)  cursor cursor_name is select ...  for update of 表+  update/delete 表where current of cursor_name （主要场景）

(2)  cursor cursor_name is select ...  for update of 表+ update/delete直接修改或者结合rowid去修改

## 2.3 规格约束

1  、数据库形态：单机，集群

2、对象类型：行表支持，  列存表（不支持），视图（来源于单表支持，多表或者从单表使用group等获取的不支持），同名词支持，物化视图（支持for upate，不支持update）

3、支持no wait，  WAIT ntimes、SKIP LOCKED

4、本身select for update的自身限定条件plsql里面同样限定，plsql不会单独处理，plsql里面不全面覆盖（是select for update本身语法），如  不可与DISTINCT，GROUP BY，FLASHBACK，聚集函数，游标表达式等组合使用，select语句 本身的复杂度不会过分关注，会涵盖join 子查询嵌套 层次化等。plsql  单独处理的仅dblink表、列存表for update拦截。多表是where current of拦截。

5、此种动态游标和隐式游标都支持for update，使用where current of报错，其他非游标相关的语句不支持for update。

  点击此处展开...

CREATE TABLE employees (    
  employee_id NUMBER(6) PRIMARY KEY,    
  first_name VARCHAR2(50),    
  last_name VARCHAR2(50),    
  email VARCHAR2(100),    
  phone_number VARCHAR2(20),    
  hire_date DATE,    
  job_id VARCHAR2(20),    
  salary NUMBER(8, 2),    
  manager_id NUMBER(6),    
  department_id NUMBER(4)    
  );    
  INSERT INTO employees (employee_id, first_name, last_name, email, phone_number, hire_date, job_id, salary, manager_id, department_id)    
  VALUES (1, 'John', 'Doe', 'john.doe@    [example.com](http://example.com)    ', '123-456-7890', TO_DATE('2022-01-15', 'YYYY-MM-DD'), 'MANAGER', 96000, NULL, 10);    
  INSERT INTO employees (employee_id, first_name, last_name, email, phone_number, hire_date, job_id, salary, manager_id, department_id)    
  VALUES (2, 'Jane', 'Smith', 'jane.smith@    [example.com](http://example.com)    ', '234-567-8901', TO_DATE('2022-02-20', 'YYYY-MM-DD'), 'SALESPERSON', 40000, 1, 20);    
  INSERT INTO employees (employee_id, first_name, last_name, email, phone_number, hire_date, job_id, salary, manager_id, department_id)    
  VALUES (3, 'John', 'KING', 'john.doe@    [example.com](http://example.com)    ', '123-456-7890', TO_DATE('2022-01-15', 'YYYY-MM-DD'), 'MANAGER', 60000, NULL, 10);

drop PROCEDURE getArea;    
  drop FUNCTION getArea_func;    
  CREATE OR REPLACE PROCEDURE getArea(cur IN OUT SYS_REFCURSOR) AS    
  BEGIN    
    OPEN cur FOR SELECT JOB_ID,last_name,first_name FROM employees WHERE salary='96000' for update;    
  END;    
  /

CREATE OR REPLACE FUNCTION getArea_func RETURN SYS_REFCURSOR AS    
    cur SYS_REFCURSOR;    
  BEGIN    
    OPEN cur FOR SELECT JOB_ID,last_name,first_name FROM employees WHERE salary='96000' for update;    
    RETURN cur;    
  END;    
  /

DECLARE    
    TYPE record IS RECORD (    
      c1 VARCHAR(20),    
   c2 VARCHAR(20),    
   c3 VARCHAR(20)    
    );    
    rec record;    
    cur SYS_REFCURSOR;    
  BEGIN    
    cur := getArea_func;    
    FETCH cur INTO rec;    
    DBMS_OUTPUT.PUT_LINE(rec.c1 ||' '||rec.c2||' '||rec.c3);    
    CLOSE cur;    
    getArea(cur);    
    FETCH cur INTO rec;    
    DBMS_OUTPUT.PUT_LINE(rec.c1 ||' '||rec.c2||' '||rec.c3);    
    CLOSE cur;    
  END;    
  /

declare    
  begin    
      for v_cur in(select JOB_ID,last_name,first_name FROM employees WHERE salary='96000' for update) loop    
          dbms_output.put_line(v_cur.JOB_ID);    
    
      end loop;    
  end;    
  /

--上面的两种可以for update使用，但是不能跟where current of结合，会报错

CREATE OR REPLACE PROCEDURE getArea(cur IN OUT SYS_REFCURSOR) AS    
  v_job_id varchar(300);    
  v_first_name varchar(300);    
  v_first_nem varchar(300);    
  BEGIN    
  OPEN cur FOR SELECT JOB_ID,last_name,first_name FROM employees WHERE salary='96000' for update;    
  fetch cur into v_job_id,v_first_name,v_first_nem;    
  UPDATE employees SET salary = salary*2 WHERE CURRENT OF cur;    
  COMMIT;    
  CLOSE cur;    
  END;    
  /

declare    
  v_job_id varchar(300);    
  v_first_name varchar(300);    
  v_first_nem varchar(300);    
  begin    
  for v_cur in(select JOB_ID,last_name,first_name FROM employees WHERE salary='96000' for update) loop    
  fetch v_cur into v_job_id,v_first_name,v_first_nem;    
  EXIT WHEN v_cur%NOTFOUND;    
  UPDATE employees SET salary = salary*2 WHERE CURRENT OF v_cur;    
  COMMIT;    
  CLOSE v_cur;    
    
  end loop;    
  end;    
  /

  


# 3. 详细测试设计

## 3.1 测试设计方法

### （1） for update游标

本次测试主要采用等价类、错误推测法进行测试

场景一：  cursor cursor_name is select ...  for update of 表+  update/delete 表where current of cursor_name

|一级分类|二级分类|测试点|  
|
|---|---|---|---|
|对象|对象类型,对象个数|对象类型：,1、支持：表（heap表）、视图  （物化视图-可以for update不可以update current of、普通视图-视图的创建方式决定是否可更新）  、同名词、临时表、分区表、lsc、tac,外部表（select for update、upadate本身不支持）、远端表(select for update 、update支持),（where条件限定全部行、部分行、无数据。锁定一列，锁定多列–是一个对象的列无影响，若是不同对象的列，有区别）,2、不支持：系统内置视图等（dba视图、动态视图等),3、select for update里面含函数,对象个数：,1、单个对象：表、视图、同名词,2、多个对象混合（更加常用）：同类对象混合、不同类对象混合（多个对象可以是不同模式下的）,2个表，只锁定其中一个表；表和视图，锁定视图。,5个表，含子查询，子查询不带for update|3、  select for update里面含函数,- select for update的from是 表+table函数处理的func（函数返回的是udt）,锁定的是表的列，成功
- select for update的from是 表+table函数处理的func（函数返回的是udt）,锁定的是func函数被table函数处理后的虚拟列，报错virtual column not allowed here（锁定别名，都是报错字段不识别）
- select for update的投影列含func+表列，锁定不指定对象，func返回的是udt，成功
- select for update的投影列只含func,锁定from 的表，函数返回的是普通常量，成功
- select from table(func) for update ,func返回的是udt,报错cannot select FOR UPDATE from collection operand
,5个表，含子查询，子查询不带for update,- 查询多个表，锁定的是2个表，修改1张表，采用cur，表数据不会被修改
- 查询多个表，锁定的是1个表，采用cur，表数据会被修改
- 锁定一个表，依次修改多张表，报错invalid ROWID
|
||表列的类型：普通类型、udt类型|普通类型：数值、字符、布尔、日期、lob、 xmltype、json、raw、rowid、bit（跟标量类型的关系不大，挑选lob xmltype json rowid bit+N类型测试）,复合类型：,内置的：ST_GEOMETRY 、box2d、GEOMETRY_PATH、GEOMETRY_DUMP_SET、GEOMETRY_DUMP（可参考  test_sdv_YDBRD_21117_ST_Dump_19）,自建的：udt、varray、object，直接锁定此类型，锁定此类型的里面的元素，不支持锁定udt的虚拟列(sql语法层都不支持）|支持直接锁定object列，锁定object里面类型(  oracle锁定里面的会core  ),支持锁定varry table,语法上无法支持锁定varry或者table里面的元素（要使用括号访问里面的方式，语法就报错）,根据上面规律，嵌套需要考虑的组合即如下几种：,1、table-varry-obj,锁定table    
  2、table-object-varray，锁定table,同2，不单独测    
  3、obj-table-varray，锁定obj成功，锁定obj里面的table报错    
  4、obj-table-obj，锁定obj成功，锁定obj里面的table类型报错，同3    
  5、obj-obj-table ，锁定obj成功，锁定obj里面的Obj成功,锁定最里层的varray报错,6、obj-obj-obj ,分别锁定三层，锁定最里层的obj报错，其他都成功|
|语法图|plsql里面简单覆盖select for update的语法图，主要把plsql的绑定传参加进去，其他本身复用的sql层解析,前面的select语句挑选性覆盖，比如  select * from employees a,employees b for update ; ,查询嵌套，最外层的查询使用for update,cte|必选项：for update,可选项：,1、for update of schema.对象名.column_name no wait,2、for update of schema.对象名.column_name wait ntimes,3、for update of schema.对象名.column_name skip locked,4、for update of schema.对象名.column_name,schema.对象名.column_name no wait,5、for update,--1，2，3不单独测，锁机制那测锁的同时可涵盖语法，4在对象处锁定一列、多列处有覆盖，5其他用例也有覆盖,6、select * from 表名   t_alias   for update of t_alias.column_name;（用例2）,7、前面select的语法，挑选多表join（构造的数据，锁定的表同一行数据返回多次），查询嵌套进行覆盖即可，不全量覆盖,8、含层次化，投影列使用了case when等,9、不支持：for update of表的伪劣、复合表达式、常量；,10、支持：,fetch的逻辑：,查询语句含伪劣，锁定的是表的列支持(含rowid的时候，record不含rowid的检测匹配情况）,fetch给一个个变量，多了个变量类型是rowid,10、不支持的语法，sql层本身就拦截的，plsql是复用的代码，不需要单独plsql里面拦截，简单覆盖，不能与DISTINCT，GROUP BY，FLASHBACK，聚集函数，游标表达式等组合使用、  子查询和CTE不能指定FOR UPDATE。,2个表union,后面的表带for update（不支持，2个表后面都带for update，sql层本身都语法解析报错）,  
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,闪回到for update前，update/delete current of cur的操作会回退?待测|
|权限|for update of的对象只有查询权限|不给表的update权限，对表进行for update不会报错；给update权限后，执行成功,不给表的delete权限，delete where current of会报错；给delete权限后，执行成功,视图需要单独给视图的查询和修改权限，不需要给视图依赖的表相关的权限,给表创建公共同义词，不给表的update权限，不可以for update其同义词,用户1的plsql1有表0的update权限，用户2有任意的plsql权限，执行plsql1|  
|
|锁机制|多个session（plsql并不单独处理，底层最后还是可以等价select for update跟其他操作的并发）,  
|加3个功能用例，多session看护，验证no wait、wait ntimes、skip locked的表现，其他dml操作（如update)未commit时，plsql的for update含如上语句的表现,一个session进行了lock table或dml的操作，第二个session进行for update会报错,一个  session进行for upate，未关闭游标（Pkg)，第二个session进行dml操作会报错|  
|
|for update游标的容错|  
|1、for update游标重复开启，重复关闭,2、对象不存在,3、仅是显示游标，不是for update显示游标，使用在where current of后面,4、select for update的语句里面执行一半有异常（某个数据是0，某个数据无法隐式转换造成中间异常等）：备注：区分plsql pkg，第二次正常调度的表现不一致,5、不循环遍历取行，直接update of报错invalid ROWID,6、未open，update/delete去使用，close后，update/delete去使用,7、pkg里面的plsql打开后，不关闭，重复调度pkg的plsql会报错cursor already open，plsql里面不关闭，重读调度plsql，成功,8、分布式加拦截，可能本身分布式的游标都不支持，若不支持，不加拦截|  
|
|跟其他特性结合|跟commit rollback结合、自治事务,事务的这，update delete的区分开测|跟commit rollback结合:,1、循环结束后，使用commit或者rollback,2、循环未结束时，如fetch取行时，end loop前含commit或者rollback会报错（表里面含有数据报错，有数据会被修改，无数据不会报错）、,3、含保存点：fetch后后面回退到open前的保存点、pkg2调度pkg1的函数func1，func1用游标修改了一部分数据，保存点bb后的都不提交，pkg2的函数进行rollback到pkg1的保存点bb，调度func1时也会把func1的保存点bb后游标修改的数据回滚掉,4、跟自治事务结合：    [Oracle自治事务详解_自事务-CSDN博客](https://blog.csdn.net/jackgo73/article/details/126156645)  ,proc1自治事务for update+where current of+commit,proc2是for update+where current of +insert + proc1+ rollback, proc1的操作不会对proc2的操作进行提交,proc1自治事务for update+where current of+rollback,proc2是for update+where current of + insert + proc1+ commit, proc1的操作不会对proc2的操作进行回滚,5、proc调度，未使用commit rollback，另外的session查看的数据是未update前的（前面的用例01里面把这个点带上）|3、proc1 proc2 for update锁定的行无交集，调度proc2成功，若含交集，报错deadlock detected while waiting for resource|
||跟游标自身结合|1、for update游标接受变量；变量区分类型：内置类型、用户自定义类型,然后作为where的限定条件里面，obj可加map方法直接比较或者obj.标量比较（proc的入参作为for update cusor的限定条件）,2、游标结合,跟for in游标+open动态游标结合,4、for update游标结果的处理：,OPEN / FETCH / CLOSE获取（fetch后再fetch)，或通过FOR LOOP遍历游标的结果集,接受游标返回值的：自定义的record、表名%rowtype、cur%rowtype。,5、游标属性+返回类型，  rowcount的场景要多关注,6、游标个数的上限,定义多个for update的cursor（300个），对于同一个表,7、同一个表的不同列for update，然后for 双重循环去访问where current of cur使用|事务重启：for update同时，有其他session进行update等操作|
|  
|跟package结合、触发器结合,  
,  
|（1）跟pkg结合,1、for update cursor传入的是pkg的变量    
  2、CUR的参数是自身函数的返回值，报错    
  3、CUR的参数是pkg里面某个私有函数的返回值，私有函数也使用了for update游标，成功,4、pkg里面有2个函数，1个函数打开，1个函数遍历使用游标,5、pkg的子过程的子过程：父打开，子过程遍历并关闭；子打开，父遍历并关闭（包游标，父子都可以随意使用;父定义子可以使用，子定义的父不可使用),pkg的子过程的子过程：父含保存点，子回滚到父的保存点；子含保存点，父回滚到子的保存点,pkg的子过程的子过程：主里面调度子，子是自治事务，主rollback不影响子,其他plsql使用包游标where current of pkg.cur–55,  
,6、跟pkg.func结合(用例50）,(1)、select func的返回值+表列for update ，func里面没有对表进行for update    
  (2)2、select func的返回值+表列for update，func里面对表进行for update     
  (3)、for update游标在使用过程中，异常退出，无异常处理，不会释放游标资源(char长度不够的异常),7、cur游标是私有函数里面使用（游标区分head里面定义和非head里面定义），pkg的全局区函数的返回值赋值给全局变量，打印全局变量的值从而调度到pkg的私有函数,（2）跟触发器结合,1、触发器里面使用for update 游标：trigger的里面使用where current of、trigger的异常处理处使用where current of、trigger基于同一张表报错,2、update for current会触发update触发器,3、跟自治触发器的点：for update游标使用在自治触发器拦截、update/delete操作可以触发自治触发器操作|  
|
|  
|跟动态执行语句、obj里面的函数结合|begin end多层嵌套：第一层打开for update游标，第二层使用并关闭,动态执行语句执行update where current of，set a=:1绑定参数传入,for update游标跟动态执行结合（动态执行的语句里面含for update游标，动态执行这个匿名块，匿名块里含for update游标的使用）,创建函数使用for update但不是用where current of,然后动态绑定参数给函数，不会执行成功也不报错（函数调度会报错cannot perform a DML operation inside a query，动态语句封装后，不报错）（42）,object的子过程里面可以出现游标（父过程定义，子过程访问并使用）|  
|
|  
|跟DBMS_METADATA.GET_DDL结合|plsql里面cursor带for update +where current of后，获取的元数据，含此定义|  
|
|  
|跟DBMS_SQL结合|```
yashan放开动态游标，部分接口支持，
支持的测试--如右边的两种用法，where current of使用在v_sql语句里，
然后结合dbms_sql使用报错
（可参考<span>test_sdv_YDBRD_22222_072）
</span>

```|  点击此处展开...,drop table tab_sdv_ydbrd_26591_091;    
  drop table tab_sdv_ydbrd_26591_091_02;    
  create table tab_sdv_ydbrd_26591_091(col1 int, col2 varchar(200));    
  insert into tab_sdv_ydbrd_26591_091 values(1001,'apple');    
  insert into tab_sdv_ydbrd_26591_091 values(1002,'orange');    
  commit;    
  create table tab_sdv_ydbrd_26591_091_02(col1 int, col2 varchar(200));,  
  DECLARE    
  C INTEGER;    
  R INTEGER;    
  V_SQL VARCHAR(32000);    
  V_INT INT;    
  C_REF SYS_REFCURSOR;    
  BEGIN    
  --V_SQL := 'SELECT 1 FROM tab_sdv_ydbrd_26591_091 ';    
  OPEN C_REF FOR SELECT 1 FROM tab_sdv_ydbrd_26591_091 for update;    
  C := DBMS_SQL.TO_CURSOR_NUMBER(C_REF);    
  DBMS_SQL.DEFINE_COLUMN(C, 1, V_INT);    
  R := DBMS_SQL.FETCH_ROWS(C);    
  DBMS_SQL.COLUMN_VALUE(C, 1, V_INT);    
  DBMS_OUTPUT.PUT_LINE(V_INT);    
  END;    
  /,CREATE OR REPLACE PROCEDURE return_rs_proc IS    
  cur1 SYS_REFCURSOR;    
  cur2 sys_refcursor;    
  BEGIN    
  OPEN cur1 FOR SELECT area_no,area_name FROM area WHERE area_no='01';    
  DBMS_SQL.RETURN_RESULT(cur1,false);    
  OPEN cur2 FOR SELECT branch_no,branch_name FROM branches WHERE area_no='01';    
  DBMS_SQL.RETURN_RESULT(cur2);    
  END;    
  /,  
|
|  
|跟select * bulk collect结合|cursor cur_name is select * bulk collect + for update作为容错  ？  （oracle支持，yashan报错）,支持select * into rec1 from tb_YDBRD_19151_59 for update   ?  (yashan是否支持待定，oracle支持),fetch bulk into,for update游标锁定，for all update修改，不带current of cur|  
|
|  
|并发开关（  alter session set degree_of_parallel = 2;）  、大数据量的上三层、打开mysql兼容开关运行用例|  
|  
|
|  
|ha备机执行、逻辑备机执行|ha备机仅含select for update、逻辑备机执行（新增了where current of语法）|  
|
|集群相关的测试点|  
|1、实例1的plsql里面for update cusor+where current of，实例2调度，实例3调度并清理对象,2、实例1pkg里定义cursor，示例2的plsql创建里面含open+where ，示例三使用并删除plsql pkg,3、实例1的plsql里面for update cusor+where current of，实例2里面for update cusor+where current of并调度实例1的plsql，实例1调度实例2的plsql（二者for update的是同一个表）,4、实例1的plsql里面for update cusor+where current of，实例2里面for update cusor+where current of并调度实例1的plsql，实例1调度实例2的plsql（二者for update的是不同表）|  
|


场景二：  cursor cursor_name is select ...  for update of 表+ update/delete直接修改或者结合rowid去修改（风险低）

|for update+where current of看护的场景会大量覆盖for update功能，场景二主要是for update的功能看护，主要是多表修改不带current of会成功|1、查询两个表，锁定1个表，修改的是锁定的表,成功    
  2、查询两个表，锁定的是2个表，修改1个表,成功    
  3、查询两个表，锁定的是1个表，修改的是2个表,成功    
  4、查询两个表，锁定的是2个表，修改的是2个表（一次修改，依次修改）,成功,5、  where的限定条件是plsql入参后者是入参(1)或者入参.元素等|  
|  
|
|---|---|---|---|


### （2）隐式游标、动态游标

可使用for update，使用where current of要加拦截

|一级分类|二级分类|测试点|
|---|---|---|
|对象|对象类型,对象个数,表列的类型|对象类型：,1、支持：表（heap表）、视图、同义词（where条件限定全部行、部分行、无数据）、  临时表或表列类型都加上,--测个同义词，同义词是视图的同义词,对象个数：,--多个对象时，把join 、子查询涵盖,表列的类型：,--内置udt、obj的里面某个元素的标量|
|跟其他特性结合|跟commit rollback结合、自治事务|跟commit rollback结合:,1、循环结束后，使用commit或者rollback,2、循环未结束时，如fetch取行时，end loop前含commit或者rollback会报错（表里面含有数据，无数据不会报错）、fetch后，后面回退到open前的保存点,3、跟自治事务结合：,proc1自治事务for update+where current of+commit,proc2是for update+where current of +insert + proc1+ rollback, proc1的操作不会对proc2的操作进行提交,proc1自治事务for update+where current of+rollback,proc2是for update+where current of + insert + proc1+ commit, proc1的操作不会对proc2的操作进行回滚,4、proc调度，未使用commit rollback，另外的session查看的数据是未update前的（前面的用例01里面把这个点带上）|
|  
|跟package结合、触发器结合|（1）跟pkg结合,1、for update cursor传入的是pkg的变量,6、跟pkg.func结合(用例50）,(2)、select func的返回值+表列for update，func里面对表进行for update,（2）跟触发器结合,1、触发器里面使用for update 游标：trigger的里面使用where current of、trigger的异常处理处使用where current of、trigger基于同一张表报错,3、跟自治触发器的点：for update游标使用在自治触发器拦截|
|  
|DBMS_METADATA.GET_DDL|plsql里面cursor带for update 后，获取的元数据，含此定义|
|  
|ha备机执行|ha备机仅含隐式游标的select for update|


动态游标增加的点：

TYPE type IS REF CURSOR RETURN cursor%ROWTYPE cursor是for update显示游标，查询语句本身含rowid和不含rowid

TYPE type IS REF CURSOR RETURN cursor_variable%ROWTYPE  其他的动态游标变量含for update（有返回值的游标变量）

REF CURSOR和sys_refcursor赋值，一个含for update ,一个不含  （赋值要多测，游标变量赋值参考并改造，游标变量加了for update，关注资源释放情况）

sys_refcursor带for upate的时候，穿插把它使用在in out参数，函数返回值。

## 3.2 详细测试设计

### 3.2.1 测试设计

1、KT设计

for update + where current of是一类，for update +不带where current of是一类

|  
|  
|  
|plsql的入参控制跟dml的语句是否相同或不同|  
|
|---|---|---|---|---|
|pkg|nowait|包游标|不同的数据|dml语句|
|  
|wait 10|私有游标|相同的数据|  
|
|  
|skip locked|  
|  
|  
|
|plsql,（pkg覆盖三种，plsql选nowait接口）,  
|nowait|  
|不同的数据|dml语句|
|  
|wait 10|  
|相同的数据|  
|
|  
|skip locked|  
|  
|  
|
|obj|  
|  
|  
|  
|
|触发器|  
|  
|  
|  
|


框架的超时无法处理事务？–想办法再怎么自动化

动态游标、隐式游标加KT 、CT用例。（dbms_sql里面使用的时候，加一组并发）

  


2、CT并发和一致性，相对于KT，无kill操作，且后置可以查询表数据跟预期比对(并发可看下事务隔离级别)

|  
|  
|  
|plsql的入参控制|  
|
|---|---|---|---|---|
|pkg|nowait|包游标|不同的数据|dml语句|
|  
|wait 10|私有游标|相同的数据|  
|
|  
|skip locked|  
|  
|  
|
|plsql,  
|nowait|  
|不同的数据|dml语句|
|  
|wait 10|  
|相同的数据|  
|
|  
|skip locked|  
|  
|  
|


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|是|
|KT kill测试|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/没有事务等待的情况下，sql的for upate和不带for update的性能、plsql里面curosr带for update和不带for update|
|长稳|是|


# 4.   **测试用例**     电子表格

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