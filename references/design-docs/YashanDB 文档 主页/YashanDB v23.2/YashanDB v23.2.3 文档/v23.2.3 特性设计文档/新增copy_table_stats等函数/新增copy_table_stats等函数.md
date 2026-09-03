Created by 郑翌恺, last modified on 五月 27, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66263f0bfd997db58adf0b58](https://pingcode.yasdb.com/pjm/items/66263f0bfd997db58adf0b58)    *?*    
  *#YDBRD-26588 新增DBMS_STATS系统包子函数*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

新增3个函数，

copy_table_stats：拷贝表分区的统计信息至表内另一个分区，包括列统计信息，local index统计信息，不会拷贝二级分区的统计信息

convert_raw_value：  将表中存储的统计信息项min，max，endpoint_value_raw（RAW类型）转换为特定类型的值

reset_global_pref_defaults：  重新设置global prefs为默认值，包括est，granularity，method_opt等全局prefs

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

### 2.1 copy_table_stats：拷贝表分区的统计信息至表内另一个分区，可以通过dba_tab_statistics，dba_part_col_statistics，dba_ind_statistics，dba_part_histograms视图查看目标分区统计信息的更新

|  
|  
|  
|
|---|---|---|
|owner|用户名|可省略，默认为当前用户|
|tabname|表名|不可省略|
|srcpartname|源分区名|不可省略|
|dstpartname|目标分区名|不可省略|
|scale factor|该参数可以放缩统计信息，如分区统计信息项blocknum，num_rows，,索引统计信息项，  除了blevel, sample_size, distinct外的索引统计信息会根据scale factor放缩,类型为float，,scale_factor = 2，目标分区num_rows*2,sclae_factor = 0.5，目标分区num_rows*0.5（取整）|可省略，默认为1|
|force|force = true，即使目标分区统计信息被锁定，也会强制复制|可省略，默认为false|


权限：统计信息权限

```
exec dbms_stats.copy_table_stats('sys', 'PT1', 'P1', 'P2', 2, TRUE);
```

### 2.2 convert_raw_value：在视图中查看统计信息lowVal，highVal字段为RAW类型，想获取真实值可以通过该函数转换并输出

|  
|  
|
|---|---|
|rawval|raw类型值|
|resval|目标类型值，支持的类型有  float，double，date，number，varchar|


权限：无权限要求

```
set serveroutput on
declare a varchar(50);
begin
dbms_stats.convert_raw_value('65', a);
dbms_output.put_line(a);
end;
/
```

### 2.3 reset_global_pref_defaults：  重新设置global prefs为默认值，不会设置表的统计信息prefs，可以通过stats_prefs$查看global_prefs修改

权限：统计信息权限

```
exec dbms_stats.reset_global_pref_defaults;
```

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

3.1 copy table stats

根据分区类型不同，会对  **分区列**  统计信息的lowVal，highVal，直方图做额外处理，

对于非分区列，所有列统计信息都会直接copy（  **非分区列是否为二级分区键，不会影响分区的统计信息copy**  ）

1.hash分区：直接拷贝src分区列的lowVal，highVal和直方图，不做额外处理

2.list分区（单个分区列）

- no default分区：lowVal和highVal会根据目标分区list列表的最小最大值设置，如partition p2(1,2,3,4)，copy(p1, p2)，设置的lowval = 1，highVal = 4，不会根据p1设置，直方图设置为NONE
- default分区：lowVal和highVal根据源分区设置，直方图同理


3.range分区（多个分区列）

对于首个分区列，列lowVal和highVal的值遵循以下规则

- 目标分区为首个分区，lowVal = 目标分区range
- 目标分区不为首个分区，lowVal = 目标分区前一个分区range
- 目标分区range为MAXVALUE，highVal = 目标分区前一个分区range
- 目标分区range不为MAXVALUE，highVal = 目标分区range


对于第二个及后续分区列，列lowVal和highVal的值遵循以下规则

- 要设置的列为Cn，目标分区为D，则设置Cn.highVal = MAX(D.range, 源分区列最大值)
- 特殊情况，若Cn-1列在分区D和前一个分区D-1的range相同，则设置Cn.highVal = D.range（无视源分区列的最大值）


对于所有分区列都需要遵循的规则

- 如果源分区列的min = max = 源分区的下界，且distinct = 1，则目标分区列min = max = 目标分区的下界
- 如果设置后的列统计信息min != max，且distinct = 0，重设distinct = 2


```
// 首个分区列用例
create table pt2(a int,b int, c int) 
partition by range(a)
(
    partition p1 values less than(10),
    partition p2 values less than(20),
    partition p3 values less than (MAXVALUE)
);
```

  


|copy(src, dst)|min|max|首个分区列a|  
|
|---|---|---|---|---|
|copy(P1, P2)|10|20|P2上界为20，设置max = 20,P2前一个分区的上界为10，设置min = 10|分区列直方图均设置为NONE,重设density = 1/distinct,如果设置后的min != max，且distinct = 0，重设distinct = 2|
|copy(P2, P1)|10|10|P1上界为10，max = 10,P1是首个分区，无法准确获取min，设置min = 10||
|copy(P1, P3)|20|20|P3无上界，max = 前一个分区上界 = 20,P3前一个分区的上界为20，设置min = 20||
|copy(P3, P2)|10|20|  
||
|copy(P3, P1)|10|10|  
||
|copy(P2, P3),P2.min = P2.max = P1.range = 10|20|20|如果源分区的min = max = 源分区下界，distinct = 1,则设置目标分区min = max = 目标分区下界,源分区的数据分布很明显，因此目标分区的min和max也需要遵循源分区的分布来处理||


```
// 第二及后续分区列用例
create table pt4(a int,b int, c int, d int) 
partition by range(a, b, c)
(
    partition p1 values less than(10, 10, 10),
    partition p2 values less than(20, 30, 40),
    partition p3 values less than(30, 30, 50)
);
insert into pt4 values(5,5,5,0);
insert into pt4 values(5,100,200,0);
exec dbms_stats.copy_table_stats(null, 'PT4', 'P1', 'P3', 1, TRUE);
```

|column|min|max|  
|
|---|---|---|---|
|a|20|20|源分区min = max = 5，distinct = 1，则设置目标分区min = max = 目标前一个分区range = 20|
|b|30|100|max = MAX(分区列b.range， 源分区列数据最大值),插入（25，100，5，0）时，该条数据会被插入p3分区，p3分区列max有可能大于b.range，所以max需要根据源分区列数据最大值去设置|
|c|40|50|前一个分区列b在分区p2和分区p3的range相同，直接设置max = c.range，忽略源分区列数据最大值,插入数据时，只要10 < b < 30，那么该条数据一定会被插入p2分区，不论c的值多大，所以c在分区p3的最大值一定是range，不需要考虑源分区列数据的最大值|
|  
|  
|  
|  
|


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

### 4.1 copy_table_stats流程

1. 获取分区级别的统计信息，对num_rows和blocks根据scale factor放缩后，写入目标分区的统计信息
1. 获取列统计信息，判断分区类型，对于分区列stats做特殊处理，非分区列不做处理直接copy
1. hash分区不用做特殊处理
1. list分区根据partBound解码后得到目标分区的list值，排出min和max后重设columnStats，直方图类型设置为NONE，再写入统计信息
1. range分区根据不同partDict的partBound得到上界，重设min和max后，直方图类型设置为NONE，再写入统计信息
1. 获取local索引统计信息，不做处理直接copy


### 4.2 convert_raw_value流程

1. 判断用户输入的变量类型是否符合
1. 调用var_conv转换函数输出


### 4.3 reset_global_pref_defaults流程

1. 读取默认的global_prefs，写入系统表stats_prefs$


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 设计不同分区类型的用例copy


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

修改    [DBMS_STATS.md](http://DBMS_STATS.md)    ，增加3个函数的描述

## Comments:

|  [](null)  ,二级分区列copy stats,Posted by zhengyikai at 五月 15, 2024 15:09|
|---|
