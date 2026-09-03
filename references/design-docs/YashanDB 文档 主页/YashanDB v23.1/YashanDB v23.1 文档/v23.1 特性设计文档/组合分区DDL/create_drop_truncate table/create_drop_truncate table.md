Created by 郭藏龙, last modified on 十一月 28, 2022

组合分区的一级和二级分区类型有很多种不同的组合，主要是要定义四部分信息：

- partition by : 一级分区类型和分区键列
- subpartition by: 二级分区类型和分区键列
- subpartition: 二级分区具体的分区定义
- partition：一级分区具体的分区定义


其中不需要完整定义每个一级分区的二级分区，可以通过二级分区模板来简化定义，每个一级分区的二区分区都会按照模型进行定义。

没有指定template，也没有指定二级分区的情况:

- 如果二级分区是range，默认创建一个high value bound全部是max value的二分区
- 如果二级分区是list, 默认创建一个high value bound为default的二级分区
- 如果二级分区是hash, 默认只创建一个二级hash分区


#####   [Hash-* Composite](#hash--composite)  

a) hash - hash， 以下是三种定义hash - hash组合分区的方式

```
-- 只指定hash分区数
create table hh_composite(a int, b int)
partition by hash(a)
subpartition by hash(b) 
subpartitions 32
partitions 16;

-- 详细定义每个一级分区的二级分区
create table hh_composite(a int, b int)
partition by hash(a)
subpartition by hash(b) 
(
partition p1
(
subpartition sp1,
subpartition sp2
),
partition p2
(
subpartition sp3,
subpartition sp4
)
);

-- 通过分区模板定义二级分区
create table hh_composite(a int, b int)
partition by hash(a)
subpartition by hash(b) 
SUBPARTITION TEMPLATE
(
subpartition sp1,
subpartition sp2
)
partitions 16; -- 这里也可以详细定义每一个一级分区 

-- 指定部分二级分区
create table hh_composite(a int, b int)
partition by hash(a)
subpartition by hash(b) 
SUBPARTITION TEMPLATE
(
subpartition sp1,
subpartition sp2
)
(
partition p1
(
subpartition sp1,
subpartition sp2
),
partition p2
);

-- 只定义部分二级分区
create table hl_composite(a int, b int)
partition by hash(a)
subpartition by hash(b) 
(
	partition p1
	(
		subpartition sp1,
		subpartition sp2
	),
	partition p2
);

```

b）hash - list

```
-- 通过模板定义二级分区
create table hl_composite(a int, b int)
partition by hash(a)
subpartition by list(b) 
SUBPARTITION TEMPLATE
(
subpartition sp1 values(10),
subpartition sp2 values(20)
)
partitions 32;

-- 详细定义每个一级分区的二级分区
create table hl_composite(a int, b int)
partition by hash(a)
subpartition by list(b) 
(
partition p1
(
subpartition sp1 values(10),
subpartition sp2 values(20)
),
partition p2
(
subpartition sp3 values(10),
subpartition sp4 values(20),
subpartition sp5 values(30)
)
);

-- 只定义部分二级分区
create table test(a int, b int)
partition by hash(a)
subpartition by list(b) 
(
	partition p1
	(
		subpartition sp1 values(10),
		subpartition sp2 values(20)
	),
	partition p2
);

```

c) hash - range

```
-- 通过模板定义二级分区
create table hr_composite(a int, b int)
partition by hash(a)
subpartition by range(b) 
SUBPARTITION TEMPLATE
(
subpartition sp1 values less than (10),
subpartition sp2 values less than (20)
)
partitions 32;

-- 详细定义每个一级分区的二级分区
create table hr_composite(a int, b int)
partition by hash(a)
subpartition by range(b) 
(
partition p1
(
subpartition sp1 values less than(10),
subpartition sp2 values less than(20)
),
partition p2
(
subpartition sp3 values less than(10),
subpartition sp4 values less than(20),
subpartition sp5 values less than(30)
)
);

-- 只定义部分二级分区
create table hl_composite(a int, b int, c int,d int)
partition by hash(a)
subpartition by range(b,c,d) 
(
	partition p1
	(
		subpartition sp1 values less than(10,20,30),
		subpartition sp2 values less than(20,20,30)
	),
	partition p2
);

```

#####   [Range-* Composite](#range--composite)  

a) range - range

```
-- 详细定义二级分区
create table rr_composite(a int, b int)
partition by range(a)
subpartition by range(b) 
(
partition p1 values less than(1)
(
subpartition sp1 values less than(10),
subpartition sp2 values less than(20)
),
partition p2 values less than(2)
(
subpartition sp3 values less than(10),
subpartition sp4 values less than(20)
)
);

-- 通过模板定义二级分区
create table rr_composite(a int, b int)
partition by range(a)
subpartition by range(b) 
subpartition template
(
subpartition sp1 values less than(10),
subpartition sp2 values less than(20)
)
(
partition p1 values less than(1),
partition p2 values less than(2)
);

```

b) range - hash

```
-- 详细定义二级分区
create table rh_composite(a int, b int)
partition by range(a)
subpartition by hash(b) 
(
partition p1 values less than(1)
(
subpartition sp1,
subpartition sp2 
),
partition p2 values less than(2)
(
subpartition sp3,
subpartition sp4
)
);

-- 通过模板定义二级分区
create table rr_composite(a int, b int)
partition by range(a)
subpartition by hash(b) 
subpartition template
(
subpartition sp1,
subpartition sp2
)
(
partition p1 values less than(1),
partition p2 values less than(2)
);

-- 指定hash分区数
create table rr_composite(a int, b int)
partition by range(a)
subpartition by hash(b) 
subpartitions 32
(
partition p1 values less than(1),
partition p2 values less than(2)
);

```

c) range - list

```
-- 详细定义二级分区
create table rl_composite(a int, b int)
partition by range(a)
subpartition by list(b) 
(
partition p1 values less than(1)
(
subpartition sp1 values(10),
subpartition sp2 values(20)
),
partition p2 values less than(2)
(
subpartition sp3 values(10),
subpartition sp4 values(20)
)
);

-- 通过模板定义二级分区
create table rl_composite(a int, b int)
partition by range(a)
subpartition by list(b) 
subpartition template
(
subpartition sp1 values(10),
subpartition sp2 values(20)
)
(
partition p1 values less than(1),
partition p2 values less than(2)
);

```

#####   [List-* Composite](#list--composite)  

a) list - list

```
-- 指定每个一级分区的二级分区信息
create table ll_composite(a int, b int)
partition by list(a)
subpartition by list(b) 
(
partition p1 values(1)
(
subpartition sp1 values(1),
subpartition sp2 values(2)
),
partition p2 values(2)
(
subpartition sp3 values(1),
subpartition sp4 values(2)
)
);

-- 通过模板指定hash分区
create table ll_composite(a int, b int)
partition by list(a)
subpartition by list(b) 
subpartition template
(
subpartition sp1 values(1),
subpartition sp2 values(2)
)
(
partition p1 values(1),
partition p2 values(2)
); 

```

b) list - hash

```
-- 指定Hash分区数量
create table lh_composite(a int, b int)
partition by list(a)
subpartition by hash(b) 
subpartitions 32
(
partition p1 values(1),
partition p2 values(2)
);

-- 通过模板指定hash分区
create table lh_composite(a int, b int)
partition by list(a)
subpartition by hash(b) 
subpartition template
(
subpartition sp1,
subpartition sp2
)
(
partition p1 values(1),
partition p2 values(2)
);

-- 指定每个一级分区的二级分区信息
create table lh_composite(a int, b int)
partition by list(a)
subpartition by hash(b) 
(
partition p1 values(1)
(
subpartition sp1,
subpartition sp2
),
partition p2 values(2)
(
subpartition sp3,
subpartition sp4
)
);

```

c) list - range

```
-- 详细定义二级分区
create table lr_composite(a int, b int)
partition by list(a)
subpartition by range(b) 
(
partition p1 values(1)
(
subpartition sp1 values less than(10),
subpartition sp2 values less than(20)
),
partition p2 values(2)
(
subpartition sp3 values less than(10),
subpartition sp4 values less than(20)
)
);

-- 通过分区模板定义二级分区
create table lh_composite(a int, b int)
partition by list(a)
subpartition by range(b) 
subpartition template
(
subpartition sp1 values less than(10),
subpartition sp2 values less than(20)
)
(
partition p1 values(1),
partition p2 values(2)
);

```

#####   [interval-* Composite](#interval--composite)  

interval作为range分区的一种扩展形式，两者在组合分区的定义上类似。由于interval后续可能会自动扩展分区，所以二级分区不能详细定义每个一级分区的二级分区，有两种方式定义interval的二级分区：

a) 通过分区模板

```
create table il_composite(a int, b int)
partition by range(a) interval(10)
subpartition by hash(b) 
subpartition template
(
subpartition sp1,
subpartition sp2
)
(
partition p1 values less than(10),
partition p2 values less than(20)
);

```

b) 如果二级是hash分区，可以通过指定hash分区数

```
create table il_composite(a int, b int)
partition by range(a) interval(10)
subpartition by hash(b) 
subpartitions 32
(
partition p1 values less than(10),
partition p2 values less than(20)
);

```

#####   [规格和约束](#规格和约束)  

- 同张表的所有分区(包括一级分区、二级分区互相之间)不能重名
- 同张表所有的二级分区数量之和不能超过1048575
