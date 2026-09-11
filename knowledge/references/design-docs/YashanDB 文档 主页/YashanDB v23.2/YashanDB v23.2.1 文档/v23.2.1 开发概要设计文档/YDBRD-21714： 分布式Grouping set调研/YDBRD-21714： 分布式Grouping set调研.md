Created by 马士杰 on 十月 14, 2024

**假设使用以下语句模拟两阶段等价场景**

**原表建表语句如下**

```
create table t1(a int, b int);
insert into t1 values(1, 2);
insert into t1 values(2, 2);
insert into t1 values(1, 3);
commit;

```

**然后使用两个表模拟根据a列作为分布键的场景下数据分布在两个DN下的场景**

```
create table t2(a int, b int);
insert into t2 values(1, 2);
insert into t2 values(1, 3);
commit;

create table t3(a int, b int);
insert into t3 values(2, 2);
commit;

```

##   [1. 普通grouping set两阶段等价调研](#1-普通grouping-set两阶段等价调研)  

由于rollup和cube完全可以转换成等价的grouping sets，因此只需要讨论grouping sets的场景

```
-- 原始执行
select a, b, sum(a), sum(b), grouping(a) gpa, grouping(b) gpb from t1 group by grouping sets(a, b) order by 1, 2;

         A          B     SUM(A)     SUM(B)        GPA        GPB
---------- ---------- ---------- ---------- ---------- ----------
         1                     2          5          0          1
         2                     2          2          0          1
                    2          3          4          1          0
                    3          1          3          1          0

```

**单独执行(1)**

```
select a, b, sum(a), sum(b), decode(grouping(a), 0, 'a is group key', NULL) gpa, decode(grouping(b), 0, 'b is group key', NULL) gpb from t2 group by grouping sets(a, b) order by gpa, gpb;

         A          B     SUM(A)     SUM(B) GPA            GPB           
---------- ---------- ---------- ---------- -------------- --------------
         1                     2          5 a is group key               
                    3          1          3                b is group key
                    2          1          2                b is group key

```

**单独执行(2)**

```
select a, b, sum(a), sum(b), decode(grouping(a), 0, 'a is group key', NULL) gpa, decode(grouping(b), 0, 'b is group key', NULL) gpb from t3 group by grouping sets(a, b) order by gpa, gpb;

         A          B     SUM(A)     SUM(B) GPA            GPB           
---------- ---------- ---------- ---------- -------------- --------------
         2                     2          2 a is group key               
                    2          2          2                b is group key

```

可以看到，此时只需要将所有的查询结果收集起来后再对a, b两列做个普通的group即可，而对于普通的聚合函数，根据两阶段的原理，sum -> sum(sum(1))，count -> sum(count(1))，而grouping部分则等价于下列语句:

```
select c1, c2, sum(c3), sum(c4), c5 as "GROUPING(C1)", c6 as "GROUPING(C2)" from (
select a c1, b c2, sum(a) c3, sum(b) c4, grouping(a) c5, grouping(b) c6 from t2 group by grouping sets(a, b)
union all
select a c1, b c2, sum(a) c3, sum(b) c4, grouping(a) c5, grouping(b) c6 from t3 group by grouping sets(a, b)) group by c1, c2, c5, c6 order by 1, 2;

        C1         C2    SUM(C3)    SUM(C4) GROUPING(C1) GROUPING(C2)
---------- ---------- ---------- ---------- ------------ ------------
         1                     2          5            0            1
         2                     2          2            0            1
                    2          3          4            1            0
                    3          1          3            1            0

```

根据grouping的语义，表示当前入参列是否作为了group key，0表示是，1表示否，因此在第二阶段时不需要将其看作普通的聚合函数，只需要将其加入group key中即可。

##   [2. 带NULL的grouping sets](#2-带null的grouping-sets)  

由rollup和cube转化来的grouping sets会产生一个NULL的group子集，即 rollup(a, b, c) => grouping sets((a, b, c), (a, b), (a), ())

```
-- 原始语句
select a, b, sum(a), sum(b), grouping(a) gpa, grouping(b) gpb from t1 group by rollup(a, b) order by 1,2;

         A          B     SUM(A)     SUM(B)        GPA        GPB
---------- ---------- ---------- ---------- ---------- ----------
         1          2          1          2          0          0
         1          3          1          3          0          0
         1                     2          5          0          1
         2          2          2          2          0          0
         2                     2          2          0          1
                               4          7          1          1

6 rows selected.
-- 注意末尾有一个group by null出来的a,b列皆无数据的行

```

**拆分1**

```
select a, b, sum(a), sum(b), grouping(a) gpa, grouping(b) gpb from t2 group by rollup(a, b) order by gpa, gpb;

         A          B     SUM(A)     SUM(B)        GPA        GPB
---------- ---------- ---------- ---------- ---------- ----------
         1          2          1          2          0          0
         1          3          1          3          0          0
         1                     2          5          0          1
                               2          5          1          1

4 rows selected.

```

**拆分2**

```
select a, b, sum(a), sum(b), grouping(a) gpa, grouping(b) gpb from t3 group by rollup(a, b) order by gpa, gpb;

         A          B     SUM(A)     SUM(B)        GPA        GPB
---------- ---------- ---------- ---------- ---------- ----------
         2          2          2          2          0          0
         2                     2          2          0          1
                               2          2          1          1

3 rows selected.


```

等价改写：

```
select c1, c2, sum(c3), sum(c4), c7 from(
select a c1, b c2, sum(a) c3, sum(b) c4, grouping(a) c5, grouping(b) c6, grouping_id(a,b) c7 from t2 group by rollup(a, b)
union all
select a c1, b c2, sum(a) c3, sum(b) c4, grouping(a) c5, grouping(b) c6, grouping_id(a,b) c7 from t3 group by rollup(a, b)) group by c1,c2,c7 order by 1, 2;

        C1         C2    SUM(C3)    SUM(C4)         C7
---------- ---------- ---------- ---------- ----------
         1          2          1          2          0
         1          3          1          3          0
         1                     2          5          1
         2          2          2          2          0
         2                     2          2          1
                               4          7          3

6 rows selected.

```

可以看出，我们可以根据grouping_id这个函数的语义，通过grouping_id(rollup列)来区分当前的group key的组合情况即可成功在二阶段的group中保证分组的正确性

##   [3.包含同样分组的grouping sets](#3包含同样分组的grouping-sets)  

原始语句：

```
select a, b, sum(a), sum(b), grouping_id(a, b), group_id() from t1 group by grouping sets((a, b), (a), (a));

         A          B     SUM(A)     SUM(B) GROUPING_ID(A,B) GROUP_ID()
---------- ---------- ---------- ---------- ---------------- ----------
         1          2          1          2                0          0
         2          2          2          2                0          0
         1          3          1          3                0          0
         1                     2          5                1          0
         2                     2          2                1          0
         1                     2          5                1          1
         2                     2          2                1          1

7 rows selected.

```

通过grouping_id与group_id的辅助，可以看到最后面几行实际是重复值，因此等价改写需要增加group_id()才能保证分组保持原样，即：

```
select c1, c2, sum(c3), sum(c4), c7, c8 from (
select a c1, b c2, sum(a) c3, sum(b) c4, grouping_id(a,b) c7, group_id() c8 from t2 group by grouping sets((a, b), (a), (a))
union all
select a c1, b c2, sum(a) c3, sum(b) c4, grouping_id(a,b) c7, group_id() c8 from t3 group by grouping sets((a, b), (a), (a))) group by c1, c2, c7, c8;

        C1         C2    SUM(C3)    SUM(C4)         C7         C8
---------- ---------- ---------- ---------- ---------- ----------
         1          2          1          2          0          0
         1          3          1          3          0          0
         1                     2          5          1          0
         1                     2          5          1          1
         2          2          2          2          0          0
         2                     2          2          1          0
         2                     2          2          1          1

7 rows selected.

```

##   [3.两阶段方案](#3两阶段方案)  

因此根据上面的实验可以得出结论，可以通过给一阶段的rollup、cube增加隐式的grouping_id函数来达成二阶段分组的目的