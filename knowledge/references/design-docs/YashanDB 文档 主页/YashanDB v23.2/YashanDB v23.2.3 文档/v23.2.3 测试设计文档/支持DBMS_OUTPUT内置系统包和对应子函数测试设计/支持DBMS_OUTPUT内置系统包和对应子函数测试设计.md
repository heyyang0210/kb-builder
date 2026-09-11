Created by 李美娥, last modified on 六月 20, 2024

# 1. 概述

      需求：        [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c7](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c7)    ?    
  #YASHAN-887 支持DBMS_OUTPUT内置系统包和对应子函数

      开发设计：    [DBMS_OUTPUT高级包 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152998688)  

dbms_output包主要用于调试pl/sql程序，或者在sql*plus命令中显示信息(displaying message)和报表。

# 2. 需求分析

## 2.1 功能点分析 

DBMS_OUTPUT子函数：

|子函数名称|描述|是否新增|对外接口|
|:---|:---|---|---|
|DISABLE Procedure|禁用消息输出，并清除缓冲区的消息|是|DBMS_OUTPUT.DISABLE,plsql里面将enable前的数据都清空,  点击此处展开...,declare     
  col varchar(1000);    
  status int;    
  begin    
  DBMS_OUTPUT.disable;    
  dbms_output.put('啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊');    
  dbms_output.put('22222222');    
  dbms_output.put('哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈');    
  DBMS_OUTPUT.NEW_LINE;    
  DBMS_OUTPUT.enable;    
  dbms_output.put_line('啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊');    
  dbms_output.get_line(col,status);    
  dbms_output.put_line('col is :' || col || ',' || 'status is : ' || status);    
  end;    
  /|
|ENABLE Procedure|启用消息输出|是|DBMS_OUTPUT.ENABLE (buffer_size IN INTEGER DEFAULT 20000);,设置为null,就是无大小限制，多次调度，以最后一次的设置为准，非not null时，最小值是2000，最大值是1000000|
|GET_LINE Procedure|从缓冲区中检索一行|是|DBMS_OUTPUT.GET_LINE (line OUT VARCHAR2, status OUT INTEGER);     
  返回最后一行缓存消息，不包含换行符。若语句执行成功，然后的是0，不成功缓存区无数据，返回的是1|
|GET_LINES Procedure|从缓冲区中检索行数组|是|DBMS_OUTPUT.GET_LINES (lines OUT CHARARR,numlines IN OUT INTEGER);    
  DBMS_OUTPUT.GET_LINES (lines OUT DBMSOUTPUT_LINESARRAY,numlines IN OUT INTEGER);    
  每一行长度的最大值是32767,  点击此处展开...,DECLARE    
  lines DBMS_OUTPUT.CHARARR;    
  numlines INTEGER;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);    
  -- 输出一些行    
  DBMS_OUTPUT.PUT_LINE('Hello, World!');    
  DBMS_OUTPUT.PUT_LINE('Another line');    
  DBMS_OUTPUT.PUT_LINE('Yet another line');    
  -- 设定要提取的行数    
  numlines := 3;    
  -- 获取输出缓冲区中的行    
  DBMS_OUTPUT.GET_LINES(lines, numlines);,-- 显示提取的行    
  FOR i IN 1..numlines LOOP    
  DBMS_OUTPUT.PUT_LINE('Extracted Line ' || i || ': ' || lines(i));    
  END LOOP;    
  END;    
  /,第一个接口：numlines必须传入值，才可访问，传入负数，不报错，函数不生效,第二个接口：numlines是指定的检索函数，可以指定>0的数，大于缓冲区的行数，就把全部的行取出，小于缓冲区总函数，取出特定的行数（会四舍五入）。默认不给值的时候，是取出缓冲区所有的数据。,若取出的是某些行，后面访问lines(i)的超过取出行，报错Subscript beyond count|
|NEW_LINE Procedure|终止使用PUT命令创建的行,(  放置一个行尾标记)|是|DBMS_OUTPUT.NEW_LINE;,PUT_LINE自带换行，使用在PUT_LINE后无实际作用，也不报错|
|PUT Procedure|将部分行放入缓冲区中且不输出数据，数据不含换行，放数据的顺序可以理解为队列，先进先出,  点击此处展开...,SET serveroutput ON;    
  BEGIN    
  DBMS_OUTPUT.PUT('yashanDB');     
  END;     
  /    
  BEGIN    
  DBMS_OUTPUT.PUT('yashanDB');     
  DBMS_OUTPUT.NEW_LINE;     
  END;     
  /,declare    
  lines varchar(200);    
  status int;    
  BEGIN    
  DBMS_OUTPUT.PUT('yashanDB');    
  DBMS_OUTPUT.NEW_LINE;    
  DBMS_OUTPUT.PUT('222yashanDB');    
  DBMS_OUTPUT.NEW_LINE;    
  DBMS_OUTPUT.GET_LINE(lines, status);    
  END;    
  /,带上new_line且后面不用get_line或get_lines获取缓冲区函数，会打印信息，要是带上get_line或get_lines函数，将缓冲区函数获取完，不打印信息，不获取完，打印未被缓冲区未被获取的信息|否|DBMS_OUTPUT.PUT ( item IN VARCHAR2); 错误给了特点的错误码|
|PUT_LINE Procedure|将行放入缓冲区并输出且数据含换行|否|DBMS_OUTPUT.PUT_LINE ( item IN VARCHAR2); 错误给了特点的错误码|


   以上接口，受set serveroutput on/off接口影响，set serveroutput off的情况下，即使高级包设置enable，也是不会打印消息的。为on的情况下，设置为disable后，不打印消息（只影响当前session，另外的sesssion不影响），后续设置回enable，后面都会打印。off是禁用消息（不清理缓存）、disblbe是禁用消息且清理缓存，二者不会造成函数功能失效。off不清理缓存信息的例子

  点击此处展开...

set serveroutput off    
  DECLARE    
  linebuf VARCHAR2(32000);    
  status INTEGER;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);

-- 输出一些行    
  DBMS_OUTPUT.PUT_LINE('Line 1');    
  DBMS_OUTPUT.PUT_LINE('Line 2');    
  DBMS_OUTPUT.PUT_LINE('Line 3');    
  DBMS_OUTPUT.PUT_LINE('Line 4');    
  --DBMS_OUTPUT.DISABLE;    
  END;    
  /    
  DECLARE    
  linebuf VARCHAR2(32000);    
  status INTEGER;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);

-- 输出一些行    
  DBMS_OUTPUT.PUT_LINE('Line 1');    
  DBMS_OUTPUT.PUT_LINE('Line 2');    
  DBMS_OUTPUT.PUT_LINE('Line 3');    
  DBMS_OUTPUT.PUT_LINE('Line 4');    
  --DBMS_OUTPUT.DISABLE;    
  END;    
  /    
  set serveroutput on    
  DECLARE    
  linebuf VARCHAR2(32000);    
  status INTEGER;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);

-- 输出一些行    
  DBMS_OUTPUT.PUT_LINE('Line 1');    
  DBMS_OUTPUT.PUT_LINE('Line 2');    
  DBMS_OUTPUT.PUT_LINE('Line 3');    
  DBMS_OUTPUT.PUT_LINE('Line 4');    
  --DBMS_OUTPUT.DISABLE;    
  END;    
  /

   put函数：带上new_line且后面不用get_line或get_lines获取缓冲区函数，会打印信息，要是带上get_line或get_lines函数，将缓冲区函数获取完，不打印信息，不获取完，打印未被缓冲区未被获取的信息。

   put_line函数：带上get_line或get_lines，不打印信息。若get_lines执行但是不生效（如传DBMS_OUTPUT.CHARARR类型，但是不给numlines初值），也会打印信息

   get_line后，再put_line或者put+new_lines会覆盖之前的缓冲区，  关注下status值

  get_line后再put等

--get_line后，再put_line会将之前缓存覆盖清理    
  drop table t2;    
  create table t2(c int,d varchar(200));    
  delete from t2;    
  declare    
  line varchar(200);    
  status int;    
  begin     
  DBMS_OUTPUT.put_line('1111fdsfd');    
  DBMS_OUTPUT.put_line('2222fdsfd');    
  DBMS_OUTPUT.put_line('3333fdsfd');    
  DBMS_OUTPUT.get_line(line,status);    
  DBMS_OUTPUT.put_line('lmelme');    
  insert into t2 values(status,line);    
  DBMS_OUTPUT.get_line(line,status);    
  insert into t2 values(status,line);    
  DBMS_OUTPUT.get_line(line,status);    
  insert into t2 values(status,line);    
  end;    
  /    
  select * from t2;

--put+new_line的效果等价put_line    
  drop table t2;    
  create table t2(c int,d varchar(200));    
  delete from t2;    
  declare    
  line varchar(200);    
  status int;    
  begin     
  DBMS_OUTPUT.put_line('1111fdsfd');    
  DBMS_OUTPUT.put_line('2222fdsfd');    
  DBMS_OUTPUT.put_line('3333fdsfd');    
  DBMS_OUTPUT.get_line(line,status);    
  DBMS_OUTPUT.put('lmelme');    
  DBMS_OUTPUT.new_line;    
  insert into t2 values(status,line);    
  DBMS_OUTPUT.get_line(line,status);    
  insert into t2 values(status,line);    
  DBMS_OUTPUT.get_line(line,status);    
  insert into t2 values(status,line);    
  end;    
  /    
  select * from t2;

  


## 2.2 应用场景

场景一：主要应用在包、plsql、触发器

由触发器、过程体或包通过PUT 和PUT_LINE将数据放入缓冲区中，然后在单独的 PL/SQL 过程或匿名块中，调度操作了put等的对象，再调用 GET_LINE 过程和 GET_LINES 过程来显示缓冲的信息。

场景二、单独exec调度。（少）

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


# 3. 详细测试设计

## 3.1 测试设计方法

等价类，边界值，场景分析。

（1）接口入参功能测试（  ENABLE   、GET_LINE 、GET_LINES ）  。

|函数名|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|:---|:---|:---|:---|:---|:---|
|DISABLE|入参个数|0,DBMS_OUTPUT.disable()、, DBMS_OUTPUT.disable;,两种方式都支持|  
|  
|1|报错|
||函数名大小写|  
|  
|成功|  
|  
|
|ENABLE    
    
    
    
    
|入参类型    
    
    
    
    
    
    
    
    
    
    
    
|数值型|INT值、BIGINT值、number值（边界、null）、,double值,非null时，值在【2000 1000000】|成功,1、测试其边界（如设置2000，信息长度正好是2000、2001，观察2001的是否报错）,2、测试值是负数小于2000，  小于2000按2000处理,3、测试值大于  1 000 000，按照1 000 000处理。|小于number边界，大于number边界，报错,关注：-1，-1被当作2000处理。|  
|
||  
|字符型|VARCHAR、CHAR、NCHAR、NVARCHAR:数字、null（‘’）|成功|带空格的字符串：‘  ’|报错|
||  
|日期类型、boolean、clob  nclob xmltype、json、raw、blob、复合类型    
    
    
    
|  
|  
|  
|报错|
||入参形式|常量 、表达式、函数处理后的结果、=>赋值、pkg.变量|  
|  
|  
|  
|
||入参个数|0、1|  
|0的时候，测试起默认值是20000|2，3|报错|
||函数名、参数名大小写|  
|  
|成功|  
|  
|
|GET_LINE    
    
    
    
|出参类型|status：,数值型、字符型|INT值、BIGINT值、number值（边界、null）、,double值：测一下null number边界即可，是出参，变量赋值后，后面调度会被覆盖|日期类型、boolean、clob  nclob xmltype、json、raw、blob、复合类型|  
|报错|
||  
|line：,字符型、clob 、nclob|  
|数值型、boolean、 xmltype、json、raw、blob、复合类型,  
|缓冲区无数据时，line的类型是数值不会报错，缓冲区有数据时，会报错类型转换失败,  点击此处展开...,DECLARE    
    linebuf int;    
    status int;    
  BEGIN    
    -- 开启 DBMS_OUTPUT    
    DBMS_OUTPUT.ENABLE(1000000);,    -- 尝试获取一行    
      DBMS_OUTPUT.GET_LINE(linebuf, status);,    -- 检查获取状态    
      IF status = 0 THEN    
        -- 如果成功获取行，则打印    
        DBMS_OUTPUT.PUT_LINE('Got line: ' || linebuf);    
      ELSIF status = 1 then    
        -- 如果无法获取行，则退出循环,      DBMS_OUTPUT.PUT_LINE('not Got line: ' || linebuf);    
     DBMS_OUTPUT.PUT_LINE(status);    
      END IF;    
  END;    
  /,  
,  
|  
|
||出参形式|常量 、pkg.变量|  
|=>赋值|  
|报错|
||出参个数|2|  
|0，1，3|  
|报错|
||函数名、参数名大小写|参数名带上双引号，区分大小写|  
|  
|  
|  
|
|GET_LINES|出参类型|lines：,CHARARR ,DBMSOUTPUT_LINESARRAY,（  TYPE CHARARR IS TABLE OF VARCHAR2(32767) INDEX BY BINARY_INTEGER;,TYPE DBMSOUTPUT_LINESARRAY IS VARRAY(2147483647) OF VARCHAR2(32767);）,  
|  
|1、其他类型：数值、字符、bool、时间、clob、blob、json等,2、类型一样（Oracle相同都不支持，若我们也不支持，不同规格的可不再测）,自定义一个varray且元素是varchar2（大小和规格同DBMSOUTPUT_LINESARRAY）,自定义一个table且元素是varchar2（大小和规格同CHARARR）|  
|报错|
||  
|numlines：,数值、字符型（值是数字）,  
|1、变量不给值，测试默认情况；,2、给的值大于0、带小数（会四舍五入）,3、number边界,4、值大于/小于缓冲区条数,5、lines是  CHARARR类型时，numlines不给初值（函数不起作用）|其他类型：数值、字符、bool、时间、clob、blob、json等,numlines给负数：第一个接口不报错，第二个接口报错|  
|报错|
||出参形式|常量 、pkg.变量|  
|=>赋值|  
|报错|
||出参个数|2|  
|0，1，3|  
|报错|
||函数名、参数名大小写|参数名带上双引号，区分大小写|  
|  
|  
|  
|
|NEW_LINE|入参个数|0,DBMS_OUTPUT.  NEW_LINE  ()、, DBMS_OUTPUT.  NEW_LINE  ;,两种方式都支持|  
|1|  
|报错|
|  
|函数名大小写|  
|  
|  
|  
|  
|
|put/put_line|入参类型|数值、字符型（varchar nvarchar)、clob 、nclob、boolean、时间类型、  JSON、xmltype、blob|  
|复合类型|  
|报错|
||入参形式|常量 、表达式、函数处理后的结果、=>赋值、pkg.变量（变量有值或无值，有值测试特殊的null）|  
|  
|  
|  
|
||入参个数|1|  
|0、2|  
|  
|
||函数名、参数名大小写|  
|  
|  
|  
|  
|


（2）场景测试，权限应该不涉及，new_line在其他函数结合里面已经测试（主要跟put结合），不再重复。

|函数名|场景|测试点|
|---|---|---|
|DISABLE    
    
    
    
|与set serveroutput on/off交互|1、on的情况下：执行，验证会清空缓冲区（on且enable的下，put数据进缓冲区，再disable,然后再enable，get_line获取不到数据）,2、off的情况下，再执行DBMS_OUTPUT.  DISABLE|
||与其他DBMS_OUTPUT交互|1、设置成disable后，验证put+new_line、 put_line不会打印信息；,put数据后，设置disable，get_line或get_lines结果入表，发现表无数据，验证其无法获取数据，disable会清理缓存；,put+new_line后，设置disable，get_line或get_lines结果入表，发现表无数据，验证其无法获取数据，disable会清理缓存；,put_line数据后，设置disable，get_line或get_lines无法获取数据，其清理缓存；,2、disable的位置，放置在其他函数的最后执行，也不会打印信息等（disable的位置，区分在这些函数前执行或这些函数执行后，再执行，比如下面的例子是后面执行，结果也不会输出，因为这个函数是要plsql执行结束才输出结果）,  点击此处展开...,drop table t2;    
  create table t2 (col1 int, col2 varchar2(100));    
  DECLARE    
    linebuf VARCHAR2(32000);    
    status INTEGER;    
  BEGIN    
    -- 开启 DBMS_OUTPUT    
    DBMS_OUTPUT.ENABLE(1000000);,  -- 输出一些行    
    DBMS_OUTPUT.PUT_LINE('Line 1');    
    DBMS_OUTPUT.PUT_LINE('Line 2');    
    DBMS_OUTPUT.PUT_LINE('Line 3');    
    DBMS_OUTPUT.PUT_LINE('Line 4');,  -- 循环逐行获取输出    
      -- 尝试获取一行    
      DBMS_OUTPUT.GET_LINE(linebuf, status);,    -- 检查获取状态    
      IF status = 0 THEN    
        -- 如果成功获取行，则打印    
        DBMS_OUTPUT.PUT_LINE('Got line: ' || linebuf);    
     insert into t2 values(status,linebuf);    
      ELSE    
        -- 如果无法获取行，则退出循环,      DBMS_OUTPUT.PUT_LINE('not Got line: ' || linebuf);    
      END IF;    
    -- 关闭 DBMS_OUTPUT    
    DBMS_OUTPUT.DISABLE;    
  END;    
  /,3、disable后再缓冲区放入数据,put数据，get_line执行获取数据入表,put+new_line数据，get_line执行获取数据入表,put_line数据，get_line执行获取数据入表|
||session生效|设置后，另起一个session，不受之前disable的影响，on的情况下，put、 put_line、 enable 、get_line、 get_lines可以使用|
|ENABLE|与set serveroutput on/off交互|on的情况下：,1、由大往小设置，后面put的大小不能超过最后设置的值,2、设置一个值A，put的数据大小大于B，后面再设置成B值,3、多次设置，最后一次设置不带参数，验证其值的大小是默认值,off的情况下：,设置的值小于于默认值，会生效，put的大小超过设置值会报错|
||与其他DBMS_OUTPUT交互|1、enable的情况下，put+new_line和put_line会打印信息,设置为2000后，一次put2000大小的数据，不会打印信息,设置为2000后，一次put2000大小的数据，然后new_line添加换行，会打印信息,设置为2000后，一次put_line2000大小的数据，会打印信息,2、跟get_line get_lines结合,设置为2000后，put多次往缓冲区放置数据，然后new_line添加换行，put的总数据据大小不超过缓冲区设置的大小，最后一次超过缓冲区的大小报错，后面再get_line获取数据,put+put_lines放入数据，get_line/ get_lines获取数据,put_lines多次往缓冲区放置数据，然后new_line添加换行或不执行，get_line/get_lines获取数据,3、enbale的位置,disable后，再put+new_line，后面再enable，再put+new_line，不会打印第一次put+new_line的信息，会打印第二次put+new_line的信息|
||session生效|设置为2000后，另起一个session，验证其大小的值|
|GET_LINE    
    
|与set serveroutput on/off交互（on或者off不影响get_line的功能）|on的情况下：,1、缓冲区无数据时，执行get_line，status是1，且无数据,2、缓冲区数据长度，超过line变量的长度，报错,3、多次执行get_line，执行的次数比缓冲区行数少（可以理解put的数据是放队列，先进先出，第一次取的，是第一次put进去的）,  点击此处展开...,drop table t1;    
  create table t1(col int,col_int int,col_var varchar(200));    
  DECLARE    
  linebuf varchar(200);    
  status int;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);    
  -- 输出一些行    
  DBMS_OUTPUT.PUT('Line 1');    
  DBMS_OUTPUT.new_line;    
  DBMS_OUTPUT.PUT('Line 2');    
  DBMS_OUTPUT.new_line;    
  DBMS_OUTPUT.PUT('Line 3');    
  DBMS_OUTPUT.new_line;    
  -- 尝试获取一行    
  DBMS_OUTPUT.GET_LINE(linebuf, status);    
  IF status = 0 THEN    
  insert into t1 values(1,status,linebuf);    
  ELSIF status = 1 then    
  insert into t1 values(2,status,linebuf);    
  END IF;    
  DBMS_OUTPUT.GET_LINE(linebuf, status);    
  IF status = 0 THEN    
  insert into t1 values(3,status,linebuf);    
  ELSIF status = 1 then    
  insert into t1 values(4,status,linebuf);    
  END IF;    
  END;    
  /    
  select * from t1;,4、多次执行get_line，执行的次数比缓冲区行数多,5、多次执行get_line，执行的次数跟缓冲区行数一样,off的情况下：,get_line（设置off，put+new_line数据，get_line去获取缓冲区数据，查看status和缓冲区数据line的值）|
||与其他DBMS_OUTPUT交互|与put 、put_line、 enable、 get_lines、new_line结合,1、put一次（长度到边界32000），new_line，get_line一次,2、put一次，无new_line，get_line一次,3、多次put，无new_line，循环去get_line后者多次get_line,4、多次put，中间new_line+最后new_line，循环去get_line后者多次get_line（多次，测一个普通的10次左右，还可以测试一个10000次，看多次put或者获取，不会造成内存等问题）,5、多次put，enable改变大小，再get_line获取数据（跟enable的结合优先级低）,6、无put，new_line，再get_line,7、多次执行get_line，每次get_line后，执行了put_line，第二次get_line时验证status是0，但是无缓冲区数据（put_line操作会将buffer清空）  --打印的顺序有些奇怪，后面请教开发,  点击此处展开...,DECLARE    
  linebuf varchar(200);    
  status int;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);    
  -- 输出一些行    
  DBMS_OUTPUT.PUT('Line 1');    
  DBMS_OUTPUT.new_line;    
  DBMS_OUTPUT.PUT('Line 2');    
  DBMS_OUTPUT.new_line;    
  DBMS_OUTPUT.PUT('Line 3');    
  DBMS_OUTPUT.new_line;    
  -- 尝试获取一行    
  DBMS_OUTPUT.GET_LINE(linebuf, status);    
  IF status = 0 THEN    
  DBMS_OUTPUT.PUT_LINE('11Got line: ' || linebuf);    
  ELSIF status = 1 then    
  DBMS_OUTPUT.PUT_LINE('11not Got line: ' || linebuf);    
  DBMS_OUTPUT.PUT_LINE(status);    
  END IF;    
  DBMS_OUTPUT.GET_LINE(linebuf, status);    
  IF status = 0 THEN    
  DBMS_OUTPUT.PUT_LINE('22Got line: ' || linebuf);    
  ELSIF status = 1 then    
  DBMS_OUTPUT.PUT_LINE('22not Got line: ' || linebuf);    
  DBMS_OUTPUT.PUT_LINE(status);    
  END IF;    
  END;    
  /,8、put_line和get_line循环多次执行,与disable结合：,验证get_line不会生效（disable后，get_line执行，验证status line值，设置成able后，再get_line，查看第二次status line值，status均是1，line无值）|
||多事务|A进行put/put_line操作，调度A，B进行get_line操作，无数据,A进行put/put_line操作，B里面调度A并进行get_line操作，有数据|
|GET_LINES|与set serveroutput on/off交互|on的情况下：,1、缓冲区无数据时，执行get_lines，无数据,2、缓冲区数据长度，超过line变量的长度，报错(传入自定义的type，规格比DBMSOUTPUT_LINESARRAY小）注：lines不支持自定义type,3、多次执行get_lines，第二次无数据返回,off的情况下：,get_lines（设置off，put或put_line数据，get_lines去获取缓冲区数据）|
||与其他DBMS_OUTPUT交互|1、get_lines把数据取完后，再执行get_line，验证status line值,2、无任何put，new_line操作，再get_lines,3、put一次（长度到边界32000），new_line，get_lines一次,4、put一次，无new_line，get_lines一次,5、多次put，无new_line，循环去get_lines后者多次get_lines,6、多次put，中间new_line+最后new_line，循环去get_lines(get_lines执行10次，循环执行10000次),7、put和get_lines循环多次执行（put一次，get_lines一次，再Put  再get_lines),与disable结合：,put数据，disable后，get_lines执行，无数据（disable清理了缓存数据）|
||多事务|A进行put/put_line操作，调度A，B进行get_lines操作，无数据,A进行put/put_line操作，B里面调度A并进行get_lines操作，有数据|
|put/put_line（跟其他的接口，get_line,get_lines时，基本都要调度put/put_line，不重复涵盖）|两种错误,字符集  （n类型的带上，lob类型）,put的数据（各种语言表情等）、数据含换行（\n，或者DBMS_UTILITY.FORMAT_CALL_STACK产生的含换行的数据）|超过buffer的总大小,行数据超过行的大小,不同字符集下，put的数据一样含中文，计算大小应该不一样|
|所有函数公共的点|创建同名的pkg，且pkg里面含函数名,typeof查询函数返回值，报错|内置的优先级高(oracle是当前创建的优先级高，我们不支持）|
||跟Pkg、plsql结合|plsql：,1、plsq a里面调度plsq b，a进行enable ，b将开关disable，a继续还进行其他put_line等操作，会打印信息,2、plsq a里面调度plsq b，a进行disable ，b将开关enable，a继续还进行其他put_line等操作，不会打印信息,3、plsql里面多层begin，最外层disable，里层enable,4、plsql里面多层begin，最外层enable，里层disable,5、,主plsql含psql1 plsql2，2个plsql一个是enable，一个是disable，相互独立不影响,主plsql下含plsql1,plsql1含plsql2，1是disable，2是enable,pkg：,pkg1里面plsql1调度pkg2里面的plsql2,psql1进行  enable ，plsql2进行disable,pkg1里面plsql1调度pkg2里面的plsql2,psql1进行disable ，plsql2进行enable,pkg里面多个plsql，有plsql是关闭，有plsql是开启，pkg2的plsql2调度pkg里面的所有的plsql。,触发器：,触发器里面使用的DBMS_OUTPUT.PUT_LINE的函数，sql语句触发触发器。|
|DBMS_OUTPUT.CHARARR|会新增一个类型，本质是udt，可简单测试（作为函数返回值）|做表列，存放get_lines的数据，会把最后的new_line的换行存放,  点击此处展开...,drop table t1;    
  create table t1(col int,col_int int,col_var DBMSOUTPUT_LINESARRAY);    
  drop table t2;    
  create table t2 (col1 int, col2 varchar2(100));    
  DECLARE    
  lines DBMSOUTPUT_LINESARRAY;    
  numlines int;    
  BEGIN    
  -- 开启 DBMS_OUTPUT    
  DBMS_OUTPUT.ENABLE(1000000);    
  -- 输出一些行    
  DBMS_OUTPUT.PUT('Line 1');    
  DBMS_OUTPUT.new_line;    
  DBMS_OUTPUT.PUT('Line 2');    
  DBMS_OUTPUT.new_line;    
  DBMS_OUTPUT.PUT('Line 3');    
  DBMS_OUTPUT.new_line;    
  -- 尝试获取一行    
  DBMS_OUTPUT.GET_LINEs(lines, numlines);    
  insert into t1 values(4,numlines,lines);    
  for i in 1 .. numlines loop    
  insert into t2 values(i,lines(i));    
  end loop;    
  END;    
  /    
  select * from t1;    
  select * from t2;,t1表是DBMSOUTPUT_LINESARRAY('Line 1', 'Line 2', 'Line 3',   NULL  )|


  


（3）分布式的测试点：（不支持）

（4）集群的测试点：

       A实例设置diable后，B实例执行put+new_line/put_line可以输出信息

       A实例执行设置enable后，B实例设置disable，执行put+new_line/put_line不可以输出信息

       A实例设置buffer大小为1，B实例设置buffer大小为2，2小于1，A实例的put数据大小为1，仍可以成功

       A实例put的数据，B实例调度A的plsql然后get_line获取数据

（5）testkill和并发（并发的还如何能验证结果，看是否有对应的框架）

      多个并发设置buffer的大小,放置小于的数据，大于的数据（并异常捕获）

      同一plsql并发使用put new_line put_line get_line

      同一plsql并发使用put new_line put_line get_lines

      不同的plsql并发使用put new_line put_line get_line   

（6）补充兼容性

        yasql旧+新服务端，打印信息（put put_line均打印），新的函数功能不支持。

       yasql新+旧服务端，新增功能不支持，put put_line是跟着新客户端的顺序，走的是新代码逻辑。

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

  


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Comments:

|  [](null)  ,（1）对齐结论：,驱动测不单独测试。,（2）意见：,1、去掉跟事务、跟高级包UTL_FILE的结合,2、字符集处跟n类型结合测试,3、put处，增加xmltype、 json类型的测试,4、补充测试先disable/enable，再on/off,5、完善创建同名的pkg，在其他用户下创建同名的udp，应该只有sys用户不能创建,6、put_line后+new_line，get_line看消息（是否含换行），多次new_line。,Posted by limeie at 五月 21, 2024 14:08|
|---|
