import React from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { initializeIcons } from 'office-ui-fabric-react/lib/Icons';
import { CommandBarButton } from 'office-ui-fabric-react';
import { exportComponentAsJPEG, exportComponentAsPDF, exportComponentAsPNG } from "react-component-export-image";
import {LineGraph} from "./chartUtils";
const monday = mondaySdk();

const dropdownStyles = {
  dropdown: { width: 300 },
};

const buttonStyles = {
    root: {height: 44, marginTop: 20}
};

class App extends React.Component {
  constructor(props) {
    super(props);
    this.componentRef = React.createRef();

    // Default state
    this.state = {
      settings: {},
      name: "",
    };
  }

    
    updateChartData(groupId, groupTitle) {
      const items = this.state.boardData.boards[0].items.filter((v=>(v.group.id === groupId))).map((val)=>({
          "id": val.id,
          "updates": val.updates,
          "status": val.column_values.filter((cval)=>(cval.title === "Status"))[0].text,
          "estimate": Number(val.column_values.filter((cval)=>(cval.title === "Time Est."))[0].text),
      }));
      const tot = items.reduce((acc,val)=>acc+val.estimate,0);
      const dn = items
      .filter((val)=>(val.status === "Done"))
      .map((val)=>({...val, "last_updated": val.updates.filter((vl=>(vl.text_body.split("").reverse().join("").indexOf("enoD") === 0)))[0].updated_at}))
      .reduce(function(acc,val){const d = new Date(val.last_updated); const str = [d.getFullYear(),d.getMonth(),d.getDate()].join("/");acc[str] = ((str in acc)?acc[str]:0)+val.estimate; return acc},{});
      const cumulativeSum = (sum => value => sum -= value)(tot);
      const burnStatus = Object.keys(dn).map((k)=>({"date":k,"val":dn[k]})).sort((a,b)=>(new Date(a.date)).getTime() - (new Date(b.date)).getTime()).map((v)=>({...v,"cur":cumulativeSum(v.val)}));
      const lineData = {
          "labels": ["Begin", ...burnStatus.map((v)=>(v.date))],
          "datasets":[{
              "label": groupTitle,
              "data": [tot, ...burnStatus.map((v)=>(v.cur))]
          }]
      };
      this.setState({lineData:lineData, selectedGroupId:groupId, selectedGroupTitle:groupTitle});
  }

  componentDidMount() {
      initializeIcons();
      monday.listen("settings", res => {
      this.setState({ settings: res.data });
      window.addEventListener('resize', this.updateWindowDimensions);
    });
      
    monday.listen("context", res => {
      this.setState({context: res.data});
      monday.api(`query ($boardIds: [Int]) { boards (ids:$boardIds) { name items {name id group { id } updates {text_body updated_at} column_values { title text } } top_group { id title }  groups { id title } } }`,
        { variables: {boardIds: this.state.context.boardIds} }
      )
      .then(res => {
        this.setState({boardData: res.data});
        this.updateChartData(res.data.boards[0].top_group.id, res.data.boards[0].top_group.title);
      });
    })

  }
  onGroupSelect = (ev, val)=>{
    this.updateChartData(val.key, val.text);
  }

  render() {
    const menuProps = {
      items: [
        {
          key: 'downloadPDF',
          text: 'Download PDF',
          onClick: () => exportComponentAsPDF(this.componentRef, `${this.state.selectedGroupTitle}.pdf`),
        },
        {
          key: 'downloadJPEG',
          text: 'Download JPEG',
          onClick: () => exportComponentAsJPEG(this.componentRef, `${this.state.selectedGroupTitle}.jpeg`),
        },
        {
          key: 'downloadPNG',
          text: 'Download PNG',
          onClick: () => exportComponentAsPNG(this.componentRef, `${this.state.selectedGroupTitle}.png`),
        }
      ],
    };
    let options = undefined;
    if (this.state.boardData) {
        options = this.state.boardData.boards[0].groups.map((v)=>({"key":v.id,"text":v.title}));
    }

    return (
      <div
        className="App"
      >
        { options && 
            <Dropdown
              placeholder="Select an option"
              label="Group for which burndown chart is to be displayed"
              defaultSelectedKey={this.state.selectedGroupId}
              options={options}
              styles={dropdownStyles}
              onChange={this.onGroupSelect}
            />
        }
        <div style={{background: (this.state.settings.background || "white"), height: "70%"}} ref={this.componentRef}>
          {this.state.lineData && <LineGraph data={this.state.lineData}/>}
        </div>
        {this.state.lineData && 
          <CommandBarButton
            iconProps={{ iconName: 'Download' }}
            text="Download this chart"
            checked={true}
            menuProps={menuProps}
            styles={buttonStyles}
          />
        }
      </div>
    );
  }

}

export default App;
