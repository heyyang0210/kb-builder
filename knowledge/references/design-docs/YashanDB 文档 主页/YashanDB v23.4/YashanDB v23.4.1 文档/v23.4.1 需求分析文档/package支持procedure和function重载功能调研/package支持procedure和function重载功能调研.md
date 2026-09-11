Created by 陈步隆, last modified on 十一月 14, 2024

### 重载能力对比

|对比项|Oracle|SQL Server|MySQL|PostgreSQL|
|---|---|---|---|---|
|全局函数、过程的重载|不支持||不支持|支持|
|函数与过程重名，参数列表一致|支持||不支持||
|参数数量不同的重载|支持|支持|不支持|支持|
|参数类型不同的重载|支持|支持|不支持|支持|
|实参到形参数据类型的隐式转换|支持|支持|不涉及|支持|
|其他|||用户通过参数+IF/ELSE逻辑可以实现类似重载能力||


注：除了Oracle特性外，其他数据库的信息基本是从AI、网页上摘录而来，可能存在不全面或不精准的问题。

Oracle plsql子程序重载说明：  [https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/plsql-subprograms.html#GUID-BE995DE8-6E36-4728-A2D3-2F8B8438D305](https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/plsql-subprograms.html#GUID-BE995DE8-6E36-4728-A2D3-2F8B8438D305)  

### Oracle不支持的重载形式

- 独立子程序（全局函数或过程）
- 仅形参类型不同（IN/OUT/IN OUT）
- 数据类型都是相同类型的子类型（Oracle PLSQL类型组：  [https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/plsql-predefined-data-types.html#GUID-1D28B7B6-15AE-454A-8134-F8724551AE8B](https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/plsql-predefined-data-types.html#GUID-1D28B7B6-15AE-454A-8134-F8724551AE8B)  ）
- 仅返回类型不同
- 仅有无参数默认值区分


【注】对于类型组的重载，实测是支持这类型同名子过程的创建，但在调用时报错。其他几种形式，在创建时就报错了。

![图片.png](https://pingcode.yasdb.com/atlas/files/public/6754042da1ad9a3311de43d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUJBQUFBUUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQWdBQUFCQUNBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUzMDIsImV4cCI6MTc4MjQ2NjEwMn0.ENgfNvUiwCrJcn9FKPz-Eui6VuLiF2j5Sn0hVXwlT-o)

### Oracle鉴定同名函数定义重载或重复的逻辑（21c实际测试）

|判定|因素|示例|
|---|---|---|
|重载|参数个数不同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number) return number;
  function test_func(val1 number, val2 number) return number;
end;
/
  2    3    4    5
Package created.
```|
||仅参数顺序不同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return number;
  function test_func(val2 number, val1 number) return number;
end;
/
  2    3    4    5
Package created.
```|
||仅参数名不同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return number;
  function test_func(val11 number, val2 number) return number;
end;
/
  2    3    4    5
Package created.
```|
||仅参数类型不同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 int) return number;
  function test_func(val1 number, val2 integer) return number;
end;
/
  2    3    4    5
Package created.
```|
||仅参数类型名不同（同类型）|```
SQL> create type xxx1 as table of int;
/
create type xxx2 as table of int;
/
CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 xxx1) return number;
  function test_func(val1 number, val2 xxx2) return number;
end;
/
  2
Type created.

SQL>   2
Type created.

SQL>   2    3    4    5
Package created.
```|
||仅返回类型名不同（同类型）|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return xxx1;
  function test_func(val1 number, val2 number) return xxx2;
end;
/
  2    3    4    5
Package created.
```|
|重复|完全相同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return number;
  function test_func(val1 number, val2 number) return number;
end;
/
  2    3    4    5
Warning: Package created with compilation errors.
```|
||仅参数大小写不同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return number;
  function test_func(Val1 number, val2 number) return number;
end;
/
  2    3    4    5
Warning: Package created with compilation errors.
```|
||仅类型大小写不同|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return number;
  function test_func(val1 Number, val2 number) return number;
end;
/
  2    3    4    5
Warning: Package created with compilation errors.
```|
||仅参数是否存在default值|```
SQL> CREATE OR REPLACE package pack_test as
  function test_func(val1 number, val2 number) return number;
  function test_func(val1 number, val2 number default 1) return number;
end;
/
  2    3    4    5
Warning: Package created with compilation errors.
```|
||仅形参类型（IN/OUT/IN OUT）不同|```
SQL> CREATE OR REPLACE package pack_test as
function test_func(val1 number, IN val2 varchar2) return number;
function test_func(val1 number, OUT val2 varchar2) return number;
end;
/
  2    3    4    5
Warning: Package created with compilation errors.
```|




### PLSQL重载相关错误码

|错误码|错误信息|出现场景|
|---|---|---|
|无|Warning: Package created with compilation errors.|不支持的重载类型（文档中说是编译期间的PLS-00305错误）|
|PLS-00306|PLS-00306: wrong number or types of arguments in call to 'TEST_FUNC'|调用时参数无法匹配到对应子程序|
|PLS-00307|PLS-00307: too many declarations of 'TEST_FUNC' match this call|调用时传入实参有歧义，匹配了多个子程序|


### 

### 数字类型匹配逻辑

仅存在数字类型参数不同时，按以下顺序进行数字参数匹配，最后选中首先被匹配上的重载子程序。

![图片.png](https://pingcode.yasdb.com/atlas/files/public/675904c2a1ad9a3311de46e6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFCQUJBQUFBUUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQWdBQUFCQUNBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUzMDIsImV4cCI6MTc4MjQ2NjEwMn0.ENgfNvUiwCrJcn9FKPz-Eui6VuLiF2j5Sn0hVXwlT-o)

#### **单个参数的匹配**

实际21c上测试的匹配顺序是这样的（只有一个参数的重载函数）

1. NUMBER
1. BINARY_FLOAT
1. BINARY_DOUBLE
1. PLS_INTEGER / BINARY_INTEGER
1. VARCHAR2


|实参类型|NUMBER/PLS_INTEGER/常量|BINARY_FLOAT|BINARY_DOUBLE|VARCHAR2|
|---|---|---|---|---|
|被匹配上的子过程的实参|1. NUMBER
1. BINARY_FLOAT
1. BINARY_DOUBLE
1. PLS_INTEGER / BINARY_INTEGER
1. VARCHAR2
|1. BINARY_FLOAT
1. BINARY_DOUBLE
1. NUMBER
1. PLS_INTEGER / BINARY_INTEGER
1. VARCHAR2
|1. BINARY_DOUBLE
1. BINARY_FLOAT
1. NUMBER
1. PLS_INTEGER / BINARY_INTEGER
1. VARCHAR2
|1. VARCHAR2
1. NUMBER
1. BINARY_FLOAT
1. BINARY_DOUBLE
1. PLS_INTEGER / BINARY_INTEGER
|


对Oracle类型之间做一下关系梳理，大概有以下几种：

1. **相同类型或子类型**  ，例如都是BINARY_FLOAT或者REAL与FLOAT
1. **组内相同属性类型**  ，例如BINARY_FLOAT、BINARY_DOUBLE（目前只识别到这两个）
1. **组内不同类型**  ，例如NUMBER类型中的NUMBER与BINARY_FLOAT
    1. **按照匹配顺序进行差异细分**
1. **类型组不同但可以隐式转换**  ，例如NUMBER与VARCHAR2
1. **类型组不同且无法隐式转换**  ，例如INT与CLOB


如果只有第1种差异，则会报错，如果只有后2/3/4差异，则通过优先级匹配一个子过程，如果出现第5种差异则报错

#### **多个参数的匹配**

在多个参数数量一致，仅类型不同时，如果参数差异整体都在某一类型，则优先匹配类型接近的子过程。

例如：两个重载函数参数列表分别是PLS_INTEGER/PLS_INTEGER，以及BINARY_FLOAT/BINARY_FLOAT，以实参BINARY_DOUBLE/BINARY_DOUBLE去调用，自然匹配到第二个函数。

如果出现如果出现参数差异不一致时，使用更复杂的匹配规则。

总体原则基本能确认：

1. 如果实参的类型能直接匹配上形参，则优先匹配对应的子过程
1. 


#### 匹配细则  **（一）**

归纳一下整个匹配规则：

1. 两个子过程按顺序逐个参数类型进行比较
    1. 类型完全相同或属于同一个类型组，则该参数比对结果标记为0
    1. 类型都属于NUMBER/BINARY_FLOAT/BINARY_DOUBLE/BINARY_INTEGER类型，顺序优先的参数比对标记为+，落后的标记为-
    1. 类型一个属于数组类型，一个属于VARCHAR2，数组类型标记为++，字符类型标记为--
1. 比对结果中有++/--的，只看这类型差异。只有++的子过程被匹配上，如果子过程有++也有--，则报错存在歧义
1. 比对结果中没有++/--，但有+/-的，只看+/-。只有+的子过程被匹配上，如果子过程有+也有-，则报错存在歧义
1. 比对结果中只有0的，报错存在歧义


**完整匹配逻辑**

1. 能直接匹配类型的
    1. 只有一个匹配的子过程，则直接选择该子过程
    1. 有超过一个的子过程被匹配上，报错存在歧义
1. 能匹配到类型组的（需要类型组转换）
    1. 只有一个匹配的子过程，则直接选择该子过程
    1. 有超过一个的子过程被匹配上，按类型匹配顺序进行匹配（参考数字类型匹配逻辑）
1. 不存在可以直接匹配类型的子过程，但有通过隐式转换规则能匹配的子过程
    1. 只有一个转换后可匹配的子过程，则直接选择该子过程
    1. 有超过一个的子过程，则报错存在歧义
1. 隐式转换也无法匹配到子过程，则报错参数个数或类型错误


【注】最早只使用常量进行验证，匹配细则（二）都能匹配成功。跟TSE对齐后，发现在非常量的场景有比较大缺陷，尝试提出匹配细则（二）

#### 匹配细则（二）

1. **遍历所有同名子过程**
    1. **对比每个实参，与其在子过程中相应的形参**
    1. **根据类型关系，记录类型差别，1、2、3、4或5**
        1. **如果是3，则再按类型次序再细分。例如NUMBER类型转BINARY_FLOAT是3.2，转BINARY_INTEGER是3.4**
    1. **将所有差异的类型数字记录下来，并统计最大值**
1. **选择出差异类型数字最大值中最小的子过程集合**
1. **如果只选出一个子过程，则匹配成功**
1. **如果没有选出一个子过程，则匹配失败，报错参数数量或类型不对**
1. **如果选出超过一个子过程，则需要两两比较，直至选出最匹配的子过程或识别到有歧义进行报错**


示例：

以实参类型分别是（NUMBER，BINARY_FLOAT，常量）去调用，最终匹配了子过程3

|序号|子过程形参|类型差别记分|差别最大值|
|---|---|---|---|
|1|PLS_INTEGER，BINARY_FLOAT，NUMBER|3.5,1,1|3.5|
|2|PLS_INTEGER，NUMBER，BINARY_DOUBLE|3.5,3.3,33|3.5|
|3|BINARY_FLOAT，BINARY_DOUBLE，NUMBER|3.2,2,1|3.2|
|4|VARCHAR2，BINARY_FLOAT，NUMBER|4,1,1|4|


#### 规则实际匹配效果

TSE的调研分析：  [https://pingcode.yasdb.com/wiki/spaces/ZHANGXIN/pages/6739c745728206efb93138c8](https://pingcode.yasdb.com/wiki/spaces/ZHANGXIN/pages/6739c745728206efb93138c8)  

|子过程形参定义|实参传入类型|匹配细则（一）|匹配细则（二）|匹配规则三（TSE的总结）|21c/19c|
|---|---|---|---|---|---|
|子过程1：PLS_INTEGER、  BINARY_FLOAT,子过程2：  NUMBER、  BINARY_DOUBLE|NUMBER  、NUMBER|匹配失败||第2个|第2个|
||NUMBER  、PLS_INTEGER|匹配失败||第2个|第2个|
||BINARY_FLOAT   PLS_INTEGER|匹配失败||匹配失败|匹配失败|
||PLS_INTEGER   NUMBER|第1个||第1个|第1个|
||BINARY_FLOAT   NUMBER|匹配失败||匹配失败|匹配失败|
||BINARY_FLOAT   BINARY_FLOAT   |匹配失败||第1个？|匹配失败|
||BINARY_DOUBLE   NUMBER|匹配失败||匹配失败|匹配失败|
||BINARY_DOUBLE   BINARY_FLOAT   |匹配失败||第1个？|匹配失败|
|子过程1：PLS_INTEGER和PLS_INTEGER,子过程2：NUMBER和BINARY_DOUBLE|NUMBER  、NUMBER|第2个||第2个|第2个|
||BINARY_DOUBLE   NUMBER|第2个||匹配失败？|第2个|
||BINARY_FLOAT   NUMBER|第2个||第2个|第2个|
||BINARY_FLOAT   PLS_INTEGER|匹配失败||第2个?|匹配失败|
||BINARY_DOUBLE   PLS_INTEGER|匹配失败||第2个?|匹配失败|
|子过程1：BINARY_FLOAT、PLS_INTEGER,子过程2：BINARY_DOUBLE、NUMBER|NUMBER   NUMBER|匹配失败|||第2个|
||NUMBER   PLS_INTEGER|第1个|||第1个|
||PLS_INTEGER   NUMBER |匹配失败|||第2个|
||BINARY_FLOAT   NUMBER|||第1个？|第2个|
||BINARY_DOUBLE   NUMBER|||第2个|第2个|
||NUMBER   BINARY_DOUBLE||||匹配失败|
||NUMBER    BINARY_FLOAT ||||匹配失败|
||PLS_INTEGER   BINARY_FLOAT ||||匹配失败|
|子过程1：PLS_INTEGER和PLS_INTEGER,子过程2：NUMBER和BINARY_FLOAT|NUMBER、NUMBER|||||
|子过程1：PLS_INTEGER和BINARY_FLOAT,子过程2：NUMBER和PLS_INTEGER|NUMBER、NUMBER|||||




### 实测对比

|对比项|场景|Oracle|OceanBase|YashanDB|
|---|---|---|---|---|
|1|function与procedure重名,```
CREATE OR REPLACE package pack_test1 as
function test_func1(val1 number) return number;
procedure test_func1(val1 number);
end;
/
```|支持,```
SQL> CREATE OR REPLACE package pack_test1 as
function test_func1(val1 number) return number;
procedure test_func1(val1 number);
end;
/  2    3    4    5  

Package created.
```|  
|不支持,```
CREATE OR REPLACE package pack_test1 as
function test_func1(val1 number) return number;
procedure test_func1(val1 number);
end;
/
   2    3    4    5 
[3:11]YAS-05290 duplicate item "TEST_FUNC1" in package
```|
|2|不同参数个数的重载,```
CREATE OR REPLACE package pack_test1 as
function test_func1(val1 number) return number;
function test_func1(val1 number, val2 number) return number;
function test_func1(val1 number, val2 number, val3 number) return number;

procedure test_func1(val1 number);
procedure test_func1(val1 number, val2 number);
procedure test_func1(val1 number, val2 number, val3 number);
end;
/

create package body pack_test1 as
function test_func1(val1 number) return number is 
begin
    return 1;
end;
function test_func1(val1 number, val2 number) return number is 
begin
    return 2;
end;
function test_func1(val1 number, val2 number, val3 number) return number is 
begin
    return 3;
end;

procedure test_func1(val1 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func1_1 ====');
end;
procedure test_func1(val1 number, val2 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func1_2 ====');
end;
procedure test_func1(val1 number, val2 number, val3 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func1_3 ====');
end;
end;
/

select pack_test1.test_func1(1) from dual;
select pack_test1.test_func1(1, 1) from dual;
select pack_test1.test_func1(1, 1, 1) from dual;
call pack_test1.test_func1(1);
call pack_test1.test_func1(1, 1);
call pack_test1.test_func1(1, 1, 1);
```|支持,```
SQL> CREATE OR REPLACE package pack_test1 as
  2  function test_func1(val1 number) return number;
  3  function test_func1(val1 number, val2 number) return number;
  4  function test_func1(val1 number, val2 number, val3 number) return number;
  5  
  6  procedure test_func1(val1 number);
  7  procedure test_func1(val1 number, val2 number);
  8  procedure test_func1(val1 number, val2 number, val3 number);
  9  end;
 10  /

Package created.

SQL> 
SQL> create package body pack_test1 as
  2  function test_func1(val1 number) return number is
  3  begin
  4  	 return 1;
  5  end;
  6  function test_func1(val1 number, val2 number) return number is
  7  begin
  8  	 return 2;
  9  end;
 10  function test_func1(val1 number, val2 number, val3 number) return number is
 11  begin
 12  	 return 3;
 13  end;
 14  
 15  procedure test_func1(val1 number) is
 16  begin
 17  	 DBMS_OUTPUT.PUT_LINE('==== call test_func1_1 ====');
 18  end;
 19  procedure test_func1(val1 number, val2 number) is
 20  begin
 21  	 DBMS_OUTPUT.PUT_LINE('==== call test_func1_2 ====');
 22  end;
 23  procedure test_func1(val1 number, val2 number, val3 number) is
 24  begin
 25  	 DBMS_OUTPUT.PUT_LINE('==== call test_func1_3 ====');
 26  end;
 27  end;
 28  /

Package body created.

SQL> 
SQL> select pack_test1.test_func1(1) from dual;

PACK_TEST1.TEST_FUNC1(1)
------------------------
		       1

SQL> select pack_test1.test_func1(1, 1) from dual;

PACK_TEST1.TEST_FUNC1(1,1)
--------------------------
			 2

SQL> select pack_test1.test_func1(1, 1, 1) from dual;

PACK_TEST1.TEST_FUNC1(1,1,1)
----------------------------
			   3

SQL> call pack_test1.test_func1(1);
==== call test_func1_1 ====

Call completed.

SQL> call pack_test1.test_func1(1, 1);
==== call test_func1_2 ====

Call completed.

SQL> call pack_test1.test_func1(1, 1, 1);
==== call test_func1_3 ====

Call completed.
```|不支持重载,```
MySQL [oceanbase]> DROP FUNCTION IF EXISTS test_func1;
Query OK, 0 rows affected (0.00 sec)

MySQL [oceanbase]> DELIMITER //
MySQL [oceanbase]> CREATE FUNCTION test_func1 (val1 DECIMAL(10,2)) RETURNS DECIMAL(10,2)
    -> DETERMINISTIC
    -> BEGIN
    ->     RETURN 1;
    -> END //
Query OK, 0 rows affected (0.05 sec)

MySQL [oceanbase]> DELIMITER ;
MySQL [oceanbase]> DELIMITER //
MySQL [oceanbase]> CREATE FUNCTION test_func1 (val1 VARCHAR(50)) RETURNS DECIMAL(10,2)
    -> DETERMINISTIC
    -> BEGIN
    ->     RETURN 2;
    -> END //
ERROR 1304 (42000): FUNCTION test_func1 already exists
MySQL [oceanbase]> DELIMITER ;
```|  
|
|3|相同参数个数，不同类型,```
CREATE OR REPLACE package pack_test2 as
function test_func2(val1 number, val2 number) return number;
function test_func2(val1 VARCHAR2, val2 number) return number;
function test_func2(val1 VARCHAR2, val2 VARCHAR2) return number;

procedure test_func2(val1 number, val2 number);
procedure test_func2(val1 VARCHAR2, val2 number);
procedure test_func2(val1 VARCHAR2, val2 VARCHAR2);
end;
/

create package body pack_test2 as
function test_func2(val1 number, val2 number) return number is 
begin
    return 11;
end;
function test_func2(val1 VARCHAR2, val2 number) return number is 
begin
    return 22;
end;
function test_func2(val1 VARCHAR2, val2 VARCHAR2) return number is 
begin
    return 33;
end;

procedure test_func2(val1 number, val2 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func2_1 ====');
end;
procedure test_func2(val1 VARCHAR2, val2 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func2_2 ====');
end;
procedure test_func2(val1 VARCHAR2, val2 VARCHAR2) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func2_3 ====');
end;
end;
/

select pack_test2.test_func2(1, 1) from dual;
select pack_test2.test_func2('abc', 1) from dual;
select pack_test2.test_func2('123', '234') from dual;
call pack_test2.test_func2(1, 1);
call pack_test2.test_func2('abc', 1);
call pack_test2.test_func2('123', '234');
```|支持,```
SQL> CREATE OR REPLACE package pack_test2 as
  2  function test_func2(val1 number, val2 number) return number;
  3  function test_func2(val1 VARCHAR2, val2 number) return number;
  4  function test_func2(val1 VARCHAR2, val2 VARCHAR2) return number;
  5  
  6  procedure test_func2(val1 number, val2 number);
  7  procedure test_func2(val1 VARCHAR2, val2 number);
  8  procedure test_func2(val1 VARCHAR2, val2 VARCHAR2);
  9  end;
 10  /

Package created.

SQL> 
SQL> create package body pack_test2 as
  2  function test_func2(val1 number, val2 number) return number is
  3  begin
  4  	 return 11;
  5  end;
  6  function test_func2(val1 VARCHAR2, val2 number) return number is
  7  begin
  8  	 return 22;
  9  end;
 10  function test_func2(val1 VARCHAR2, val2 VARCHAR2) return number is
 11  begin
 12  	 return 33;
 13  end;
 14  
 15  procedure test_func2(val1 number, val2 number) is
 16  begin
 17  	 DBMS_OUTPUT.PUT_LINE('==== call test_func2_1 ====');
 18  end;
 19  procedure test_func2(val1 VARCHAR2, val2 number) is
 20  begin
 21  	 DBMS_OUTPUT.PUT_LINE('==== call test_func2_2 ====');
 22  end;
 23  procedure test_func2(val1 VARCHAR2, val2 VARCHAR2) is
 24  begin
 25  	 DBMS_OUTPUT.PUT_LINE('==== call test_func2_3 ====');
 26  end;
 27  end;
 28  /

Package body created.

SQL> 
SQL> select pack_test2.test_func2(1, 1) from dual;

PACK_TEST2.TEST_FUNC2(1,1)
--------------------------
			11

SQL> select pack_test2.test_func2('abc', 1) from dual;

PACK_TEST2.TEST_FUNC2('ABC',1)
------------------------------
			    22

SQL> select pack_test2.test_func2('123', '234') from dual;

PACK_TEST2.TEST_FUNC2('123','234')
----------------------------------
				33

SQL> call pack_test2.test_func2(1, 1);
==== call test_func2_1 ====

Call completed.

SQL> call pack_test2.test_func2('abc', 1);
==== call test_func2_2 ====

Call completed.

SQL> call pack_test2.test_func2('123', '234');
==== call test_func2_3 ====

Call completed.
```|  
|  
|
|4|相同参数个数和类型，不同返回类型,```
CREATE OR REPLACE package pack_test3 as
function test_func3(val1 number, val2 number) return number;
function test_func3(val1 number, val2 number) return VARCHAR2;
end;
/

create package body pack_test3 as
function test_func3(val1 number, val2 number) return number is 
begin
    return 111;
end;
function test_func3(val1 number, val2 number) return VARCHAR2 is 
begin
    return '222';
end;
end;
/

select pack_test3.test_func3(1, 1) + 3 from dual;
select pack_test3.test_func3(1, 1) || 'abc' from dual
```|支持创建，调用时识别到可以匹配多个函数，则报错,```
SQL> CREATE OR REPLACE package pack_test3 as
  2  function test_func3(val1 number, val2 number) return number;
  3  function test_func3(val1 number, val2 number) return VARCHAR2;
  4  end;
  5  /

Package created.

SQL> 
SQL> create package body pack_test3 as
  2  function test_func3(val1 number, val2 number) return number is
  3  begin
  4  	 return 111;
  5  end;
  6  function test_func3(val1 number, val2 number) return VARCHAR2 is
  7  begin
  8  	 return '222';
  9  end;
 10  end;
 11  /

Package body created.

SQL> 
SQL> select pack_test3.test_func3(1, 1) + 3 from dual;
select pack_test3.test_func3(1, 1) + 3 from dual
       *
ERROR at line 1:
ORA-06553: PLS-307: too many declarations of 'TEST_FUNC3' match this call


SQL> select pack_test3.test_func3(1, 1) || 'abc' from dual;
select pack_test3.test_func3(1, 1) || 'abc' from dual
       *
ERROR at line 1:
ORA-06553: PLS-307: too many declarations of 'TEST_FUNC3' match this call
```|  
|  
|
|5|部分参数使用默认值，指定的参数在各函数中类型不同,```
CREATE OR REPLACE package pack_test22 as
function test_func22(val1 number default 1, val2 number) return number;
function test_func22(val1 VARCHAR2 default '1', val2 number) return number;
function test_func22(val1 VARCHAR2, val2 VARCHAR2) return number;

procedure test_func22(val1 number default 1, val2 number);
procedure test_func22(val1 VARCHAR2 default '1', val2 number);
procedure test_func22(val1 VARCHAR2, val2 VARCHAR2);
end;
/

create package body pack_test22 as
function test_func22(val1 number, val2 number) return number is 
begin
    return 11;
end;
function test_func22(val1 VARCHAR2, val2 number) return number is 
begin
    return 22;
end;
function test_func22(val1 VARCHAR2, val2 VARCHAR2) return number is 
begin
    return 33;
end;

procedure test_func22(val1 number, val2 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func22_1 ====');
end;
procedure test_func22(val1 VARCHAR2, val2 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func22_2 ====');
end;
procedure test_func22(val1 VARCHAR2, val2 VARCHAR2) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func22_3 ====');
end;
end;
/

select pack_test22.test_func22(val2 => 1) from dual;
call pack_test22.test_func22(val2 => 1);
```|调用能匹配多个函数时，报错提示,```
SQL> CREATE OR REPLACE package pack_test22 as
  2  function test_func22(val1 number default 1, val2 number) return number;
  3  function test_func22(val1 VARCHAR2 default '1', val2 number) return number;
  4  function test_func22(val1 VARCHAR2, val2 VARCHAR2) return number;
  5  
  6  procedure test_func22(val1 number default 1, val2 number);
  7  procedure test_func22(val1 VARCHAR2 default '1', val2 number);
  8  procedure test_func22(val1 VARCHAR2, val2 VARCHAR2);
  9  end;
 10  /

Package created.

SQL> 
SQL> create package body pack_test22 as
  2  function test_func22(val1 number, val2 number) return number is
  3  begin
  4  	 return 11;
  5  end;
  6  function test_func22(val1 VARCHAR2, val2 number) return number is
  7  begin
  8  	 return 22;
  9  end;
 10  function test_func22(val1 VARCHAR2, val2 VARCHAR2) return number is
 11  begin
 12  	 return 33;
 13  end;
 14  
 15  procedure test_func22(val1 number, val2 number) is
 16  begin
 17  	 DBMS_OUTPUT.PUT_LINE('==== call test_func22_1 ====');
 18  end;
 19  procedure test_func22(val1 VARCHAR2, val2 number) is
 20  begin
 21  	 DBMS_OUTPUT.PUT_LINE('==== call test_func22_2 ====');
 22  end;
 23  procedure test_func22(val1 VARCHAR2, val2 VARCHAR2) is
 24  begin
 25  	 DBMS_OUTPUT.PUT_LINE('==== call test_func22_3 ====');
 26  end;
 27  end;
 28  /

Package body created.

SQL> 
SQL> select pack_test22.test_func22(val2 => 1) from dual;
select pack_test22.test_func22(val2 => 1) from dual
       *
ERROR at line 1:
ORA-06553: PLS-307: too many declarations of 'TEST_FUNC22' match this call


SQL> call pack_test22.test_func22(val2 => 1);
call pack_test22.test_func22(val2 => 1)
     *
ERROR at line 1:
ORA-06553: PLS-307: too many declarations of 'TEST_FUNC22' match this call
```|  
|  
|
|6|函数参数不同，调用时需要进行参数转换场景,```
CREATE OR REPLACE package pack_test222 as
function test_func222(val1 number, val2 VARCHAR2) return number;
function test_func222(val1 VARCHAR2, val2 number) return number;

procedure test_func222(val1 number, val2 VARCHAR2);
procedure test_func222(val1 VARCHAR2, val2 number);
end;
/

create package body pack_test222 as
function test_func222(val1 number, val2 VARCHAR2) return number is 
begin
    return 11;
end;
function test_func222(val1 VARCHAR2, val2 number) return number is 
begin
    return 22;
end;

procedure test_func222(val1 number, val2 VARCHAR2) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func222_1 ====');
end;
procedure test_func222(val1 VARCHAR2, val2 number) is 
begin
    DBMS_OUTPUT.PUT_LINE('==== call test_func222_2 ====');
end;
end;
/

select pack_test222.test_func222('1', 1) from dual;
select pack_test222.test_func222(1, '1') from dual;
select pack_test222.test_func222(1, 1) from dual;
call pack_test222.test_func222('1', 1);
call pack_test222.test_func222(1, '1');
call pack_test222.test_func222(1, 1);
```|参数完全一致时，调用正常；参数没有完全匹配，但经过转换都能匹配上时，报错提示,```
SQL> CREATE OR REPLACE package pack_test222 as
  2  function test_func222(val1 number, val2 VARCHAR2) return number;
  3  function test_func222(val1 VARCHAR2, val2 number) return number;
  4  
  5  procedure test_func222(val1 number, val2 VARCHAR2);
  6  procedure test_func222(val1 VARCHAR2, val2 number);
  7  end;
  8  /

Package created.

SQL> 
SQL> create package body pack_test222 as
  2  function test_func222(val1 number, val2 VARCHAR2) return number is
  3  begin
  4  	 return 11;
  5  end;
  6  function test_func222(val1 VARCHAR2, val2 number) return number is
  7  begin
  8  	 return 22;
  9  end;
 10  
 11  procedure test_func222(val1 number, val2 VARCHAR2) is
 12  begin
 13  	 DBMS_OUTPUT.PUT_LINE('==== call test_func222_1 ====');
 14  end;
 15  procedure test_func222(val1 VARCHAR2, val2 number) is
 16  begin
 17  	 DBMS_OUTPUT.PUT_LINE('==== call test_func222_2 ====');
 18  end;
 19  end;
 20  /

Package body created.

SQL> 
SQL> select pack_test222.test_func222('1', 1) from dual;

PACK_TEST222.TEST_FUNC222('1',1)
--------------------------------
			      22

SQL> select pack_test222.test_func222(1, '1') from dual;

PACK_TEST222.TEST_FUNC222(1,'1')
--------------------------------
			      11

SQL> select pack_test222.test_func222(1, 1) from dual;
select pack_test222.test_func222(1, 1) from dual
       *
ERROR at line 1:
ORA-06553: PLS-307: too many declarations of 'TEST_FUNC222' match this call


SQL> call pack_test222.test_func222('1', 1);
==== call test_func222_2 ====

Call completed.

SQL> call pack_test222.test_func222(1, '1');
==== call test_func222_1 ====

Call completed.

SQL> call pack_test222.test_func222(1, 1);
call pack_test222.test_func222(1, 1)
     *
ERROR at line 1:
ORA-06553: PLS-307: too many declarations of 'TEST_FUNC222' match this call
```|  
|  
|








测试类型

```
CREATE OR REPLACE package pack_test as
function test_func(val1 number, val2 varchar2) return number;
function test_func(val1 number, val2 nvarchar2) return number;
function test_func(val1 number, val2 smallint) return number;
function test_func(val1 number, val2 int) return number;
function test_func(val1 number, val2 integer) return number;
function test_func(val1 number, val2 long) return number;
function test_func(val1 number, val2 number) return number;
function test_func(val1 number, val2 float) return number;
function test_func(val1 number, val2 binary_float) return number;
function test_func(val1 number, val2 binary_double) return number;
function test_func(val1 number, val2 char) return number;
function test_func(val1 number, val2 nchar) return number;
function test_func(val1 number, val2 xxx1) return number;
function test_func(val1 number, val2 xxx2) return number;
function test_func(val1 number, val2 date) return number;
function test_func(val1 number, val2 TIMESTAMP) return number;
function test_func(val1 number, val2 TIMESTAMP WITH TIME ZONE) return number;
function test_func(val1 number, val2 TIMESTAMP WITH LOCAL TIME ZONE) return number;
function test_func(val1 number, val2 INTERVAL YEAR TO MONTH) return number;
function test_func(val1 number, val2 INTERVAL DAY TO SECOND) return number;
function test_func(val1 number, val2 RAW) return number;
function test_func(val1 number, val2 LONG RAW) return number;
function test_func(val1 number, val2 ROWID) return number;
function test_func(val1 number, val2 UROWID) return number;
function test_func(val1 number, val2 CLOB) return number;
function test_func(val1 number, val2 NCLOB) return number;
function test_func(val1 number, val2 BLOB) return number;
function test_func(val1 number, val2 BFILE) return number;
function test_func(val1 number, val2 JSON) return number;
function test_func(val1 number, val2 BOOLEAN) return number;
end;
/

CREATE OR REPLACE package body pack_test as
function test_func(val1 number, val2 varchar2) return number is begin return 1; end;
function test_func(val1 number, val2 nvarchar2) return number is begin return 1; end;
function test_func(val1 number, val2 smallint) return number is begin return 1; end;
function test_func(val1 number, val2 int) return number is begin return 1; end;
function test_func(val1 number, val2 integer) return number is begin return 1; end;
function test_func(val1 number, val2 long) return number is begin return 1; end;
function test_func(val1 number, val2 number) return number is begin return 1; end;
function test_func(val1 number, val2 float) return number is begin return 1; end;
function test_func(val1 number, val2 binary_float) return number is begin return 1; end;
function test_func(val1 number, val2 binary_double) return number is begin return 1; end;
function test_func(val1 number, val2 char) return number is begin return 1; end;
function test_func(val1 number, val2 nchar) return number is begin return 1; end;
function test_func(val1 number, val2 xxx1) return number is begin return 1; end;
function test_func(val1 number, val2 xxx2) return number is begin return 1; end;
function test_func(val1 number, val2 date) return number is begin return 1; end;
function test_func(val1 number, val2 TIMESTAMP) return number is begin return 1; end;
function test_func(val1 number, val2 TIMESTAMP WITH TIME ZONE) return number is begin return 1; end;
function test_func(val1 number, val2 TIMESTAMP WITH LOCAL TIME ZONE) return number is begin return 1; end;
function test_func(val1 number, val2 INTERVAL YEAR TO MONTH) return number is begin return 1; end;
function test_func(val1 number, val2 INTERVAL DAY TO SECOND) return number is begin return 1; end;
function test_func(val1 number, val2 RAW) return number is begin return 1; end;
function test_func(val1 number, val2 LONG RAW) return number is begin return 1; end;
function test_func(val1 number, val2 ROWID) return number is begin return 1; end;
function test_func(val1 number, val2 UROWID) return number is begin return 1; end;
function test_func(val1 number, val2 CLOB) return number is begin return 1; end;
function test_func(val1 number, val2 NCLOB) return number is begin return 1; end;
function test_func(val1 number, val2 BLOB) return number is begin return 1; end;
function test_func(val1 number, val2 BFILE) return number is begin return 1; end;
function test_func(val1 number, val2 JSON) return number is begin return 1; end;
function test_func(val1 number, val2 BOOLEAN) return number is begin return 1; end;
end;
/
```



### Oracle类型组（21c实际测试）

|类型类别（类型组）|类型或子类型|||
|---|---|---|---|
|字符类型|varchar2, nvarchar2, long, char, nchar|||
|数字类型|number, float, smallint, int, integer|||
|binary_float|binary_float|||
|binary_double|binary_double|||
|TIMESTAMP|TIMESTAMP|||
|TIMESTAMP WITH TIME ZONE|TIMESTAMP WITH TIME ZONE|||
|TIMESTAMP WITH LOCAL TIME ZONE|TIMESTAMP WITH LOCAL TIME ZONE|||
|INTERVAL YEAR TO MONTH|INTERVAL YEAR TO MONTH|||
|INTERVAL DAY TO SECOND|INTERVAL DAY TO SECOND|||
|RAW|RAW, LONG RAW|||
|ROWID|ROWID|||
|UROWID|UROWID|||
|CLOB|CLOB, NCLOB|||
|BLOB|BLOB|||
|BFILE|BFILE|||
|JSON|JSON|||
|BOOLEAN|BOOLEAN|||
|UDT||||


