Created by 李子怡 on 八月 27, 2024

SR:    [支持MySQL约束相关DDL](https://pingcode.yasdb.com/pjm/items/66190a1bfd997db58ad884c4? #YDBRD-26255 支持MySQL约束相关DDL)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#1-overview%E6%A6%82%E8%BF%B0)  

在原有的mysql框架之上，适配约束相关DDL  。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

【索引、外键和 CHECK 约束】 

（1）PRIMARY KEY：DROP PRIMARY KEY

          唯一索引，必须定义为NOT NULL。如果没有显式声明，会隐式声明为NOT NULL。

          既可以作为表约束，也可以作为列约束。

          存在外键时会无法删除。

          删除语法： ALTER TABLE [table_name] DROP PRIMARY KEY 

                             （alter table ... modify/change...不能删除prinary key, unique）

                               ALTER TABLE [table_name] MODIFY  [column_name] [column_def] NULL (可以删除非空约束)

                               ALTER TABLE [table_name] CHANGE  [old_column_name] [new_column_name] [column_def] NULL  (可以删除非空约束)

          

          添加语法： ALTER TABLE [table_name] ADD PRIMARY KEY   (  primary_key_column  )

                             ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] PRIMARY KEY   (  primary_key_column  )

                             ALTER TABLE [table_name] MODIFY [column_name] [column_def] PRIMARY KEY

                             ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] PRIMARY KEY

         差异点：MYSQL允许对同一列建多个唯一约束， yashan (报错： such unique or primary key already exists in the table)

![](https://pingcode.yasdb.com/atlas/files/public/67396ed78970c2af4f521bd1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQzNzEsImV4cCI6MTc4MjQ1NTE3MX0.vBo9VafWBcucpK2f-w1rzp7XOaNJWu_f51zJRef6kGY)

     

（2）KEY | INDEX ：KEY 通常是 INDEX 的同义词。 当在列定义中给定时，键属性 PRIMARY KEY 也可以指定为 KEY

在MySQL中，”KEY”关键字有两种作用：一种是创建索引，另一种是定义外键。

```
key 通常是index的同义词，当要为列创建索引，但不是主键或唯一键时使用KEY
例：
create table students(
 id int not null,
 name varchar(50) not null,
 key idex_name(name)
);

等价于：
create table students(
 id int not null,
 name varchar(50) not null,
 index idex_name(name)
);

定义外键：
CREATE TABLE orders (
    id INT NOT NULL,
    student_id INT NOT NULL,
    order_date DATE NOT NULL,
    PRIMARY KEY (id),
    KEY fk_student_id (student_id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);


PRIMAY KEY 也可指定为KEY (此时key不能替换为index):
例：
CREATE TABLE COMPAT_MYSQL_TEST_KEY(A INT PRIMARY KEY);
等同于：
CREATE TABLE COMPAT_MYSQL_TEST_KEY(A INT KEY);

drop primary key不能替换为drop key

```

（3）DROP：ALTER TABLE newtable DROP FOREIGN KEY newtable_FK

删除语法： ALTER TABLE [table_name] DROP FOREIGN KEY [fk_name]

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
static CodBool myTryParseOutlineCons(AnlParser* parser, LangWord* word, TableDef* def, CodBool* isConstraint)                           ---表约束
static CodResult myParseColumnInlineCons(AnlParser* parser, LangWord* word, ColumnDef* colDef, List* consDefList, CodUint32* clauses)   ---列约束

CodResult tabAddIndexes(AnkHandler* handler, List* colDefList, CodUint32 owner, DictEntry* entry, CodBool isSysTable)                   ---创建表的时候添加索引

typedef struct StForeignKeyDef {
    ......
    IndexDef*     idxDef;    // used for mysql only
    ......
} ForeignKeyDef;

typedef struct StTableDef {
    ......
    IndexDef*     idxDef;    // used for mysql only
    ......
} TableDef;

```

  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 索引、外键和 CHECK 约束的规格默认与yashan保持一致。
- 一张表中最多有一个主键约束。
- 为列创建索引，不是主键或唯一键时可使用KEY替代INDEX （单列索引，多列索引）。
- 在创建外键时，需要注意参照的表中该列必须是PRIMARY KEY或UNIQUE KEY，否则无法定义成功。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 索引关注INDEX 替换为KEY的表现。
1. mysql 5种类型的约束都覆盖（not null, unique, primary key, foreign key, check）。
1. 表级约束： PRIMARY KEY | UNIQUE | CHECK | FOREIGN KEY
1. 列级约束： PRIMARY KEY | UNIQUE | CHECK | NOT NULL     
1. check约束重点关注表达式语法差异。
1. alter table ...change语法对索引、外键和check约束的修改。


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

ALTER TABLE ...DROP INDEX ....

ALTER TABLE... ADD UNIQUE INDEX

USING BTREE ON... 

放在索引SR完成

## Attachments: